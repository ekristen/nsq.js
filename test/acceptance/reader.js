
var utils = require('../utils');
var assert = require('assert');
var nsq = require('../..');

describe('Reader', function(){
  beforeEach(function(done){
    utils.deleteTopic('test', function(){
      done();
    });
  })

  describe('with .nsqd addresses', function(){
    it('should subscribe to messages', function(done){
      var pub = nsq.writer();

      var sub = nsq.reader({
        topic: 'test',
        channel: 'reader',
        nsqd: ['0.0.0.0:4150']
      });

      pub.on('ready', function(){
        pub.publish('test', 'something');
      });

      sub.once('message', function(msg){
        msg.finish();
        done();
      });
    })
  })

  describe('with .nsqlookupd addresses', function(){
    it('should subscribe to messages', function(done){
      var pub = nsq.writer();

      pub.on('ready', function(){
        pub.publish('test', 'something', function(err){
          if (err) return done(err);

          var sub = nsq.reader({
            topic: 'test',
            channel: 'reader',
            nsqlookupd: ['0.0.0.0:4161']
          });

          sub.on('message', function(msg){
            msg.finish();
            done();
          });
        });
      });
    })

    it('should set .timer attribute', function(){
      var sub = nsq.reader({
        topic: 'test',
        channel: 'reader',
        nsqlookupd: ['0.0.0.0:4161']
      });

      assert(sub.timer !== null);
    })
  })

  it('should discard messages after the max attempts', function(done){
    var pub = nsq.writer();

    var sub = nsq.reader({
      topic: 'test',
      channel: 'reader',
      nsqd: ['0.0.0.0:4150'],
      maxAttempts: 5
    });

    pub.on('ready', function(){
      pub.publish('test', 'something');
    });

    sub.on('message', function(msg){
      msg.requeue();
    });

    sub.once('discard', function(msg){
      sub.removeAllListeners('message');
      done();
    });
  })
})

describe('Reader#close()', function(){
  beforeEach(function(done){
    utils.deleteTopic('test', function(){
      done();
    });
  })

  it('should wait for pending messages and emit "close"', function(done){
    var pub = nsq.writer();
    var recv = 0;

    var sub = nsq.reader({
      topic: 'test',
      channel: 'reader',
      nsqd: ['0.0.0.0:4150'],
      maxInFlight: 10
    });

    var n = 0;
    pub.on('ready', function(){
      var count = 30;
      while (count--) pub.publish('test', { n: n++ });
    });

    sub.on('close', function(){
      assert(recv < 30, 'received too many messages');
      done();
    });

    sub.on('message', function(msg){
      setTimeout(function(){
        if (recv++ == 10) sub.close();
        msg.finish();
      }, 50);
    });
  })
})

describe('Reader#close(fn)', function(){
  beforeEach(function(done){
    utils.deleteTopic('test', function(){
      done();
    });
  })

  it('should wait for pending messages and invoke the callback', function(done){
    var pub = nsq.writer();
    var recv = 0;

    var sub = nsq.reader({
      topic: 'test',
      channel: 'reader',
      nsqd: ['0.0.0.0:4150'],
      maxInFlight: 10
    });

    var n = 0;
    pub.on('ready', function(){
      var count = 30;
      while (count--) pub.publish('test', { n: n++ });
    });

    sub.on('message', function(msg){
      setTimeout(function(){
        if (recv++ == 10) {
          sub.close(function(){
            assert(recv < 30, 'received too many messages');
            done();
          });
        }
        msg.finish();
      }, 50);
    });
  })

  it('should close if there are no in-flight messages', function(done){
    var pub = nsq.writer();

    var sub = nsq.reader({
      topic: 'empty',
      channel: 'reader',
      nsqd: ['0.0.0.0:4150'],
      maxInFlight: 10
    });

    sub.on('ready', function(){
      // give it some time to SUB... lame
      // add subscribe event?
      setTimeout(function(){
        sub.close(done);
      }, 100);
    });
  })
})

describe('Reader#close(fn)', function(){
  it('should stop polling nsqlookupd if reader had been closed', function(done){
    var sub = nsq.reader({
      topic: 'test',
      channel: 'reader',
      nsqlookupd: ['0.0.0.0:4161'],
      pollInterval: 100
    });

    sub.close();

    setTimeout(done, 500);

    sub.lookup = function(fn){
      done(new Error('setInterval() is still running'));
    };
  })
})
