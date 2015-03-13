var mongoose = require('mongoose');
var Post = mongoose.model('Post');

module.exports = function(System) {
  var obj = {};
  var json = System.plugins.JSON;
  var event = System.plugins.event;
  var sck = System.webSocket;

  /**
   * Post related socket emmissions
   */
  sck.on('connection', function(socket){
    socket.on('like', function(postId) {
      socket.broadcast.emit('like', postId);
    });
    socket.on('unlike', function(postId) {
      socket.broadcast.emit('unlike', postId);
    });
    socket.on('comment', function(postId) {
      socket.broadcast.emit('comment', postId);
    });
    socket.on('feed', function(postId) {
      //get all followers of the creator
      var User = mongoose.model('User');
      Post.findOne({ _id: postId }).exec(function(err, post) {
        User.find({following: post.creator}, '_id', function(err, followers) {
          socket.broadcast.emit('feed', {followers: followers, creator: post.creator});
        });
      });
    });
  });

  /**
   * Create a new post
   * @param  {Object} req Request
   * @param  {Object} res Response
   * @return {Void}
   */
  obj.create = function(req, res) {
    var post = new Post(req.body);
    post.creator = req.user._id;
    post.save(function(err) {
      post = post.afterSave(req.user);
      event.trigger('newpost', {post: post, actor: req.user});
      if (err) {
        return json.unhappy(err, res);
      }
      return json.happy(post, res);
    });
  };

  /**
   * Create a new comment
   * @param  {Object} req Request
   * @param  {Object} res Response
   * @return {Void}
   */
  obj.comment = function(req, res) {
    var postId = req.params.postId;
    Post.findOne({ _id: postId }).populate('creator').populate('comments').populate('comments.creator').exec(function(err, post) {
      post.comments.push({
        creator: req.user,
        content: req.body.comment
      });
      post.comments.sort(function(a, b) {
        var dt1 = new Date(a.created);
        var dt2 = new Date(b.created);
        if (dt1 > dt2) {
          return -1;
        } else {
          return 1;
        }
      });
      post.save(function(err) {
        post = post.afterSave(req.user);
        event.trigger('comment', {post: post, actor: req.user});
        if (err) {
          return json.unhappy(err, res);
        }
        return json.happy({
          record: post
        }, res);
      });
    });
  };

  /**
   * Get posts written by the current user
   * @param  {Object} req The request object
   * @param  {Object} res The response object
   * @return {Void}
   */
  obj.timeline = function(req, res) {
    var userId = req.params.userId || req.user._id;
    //TODO: pagination
    var criteria = { creator: userId };
    if (req.query && req.query.timestamp) {
      criteria.created = { $gte: req.query.timestamp };
    }
    Post.find(criteria, null, {sort: {created: -1}}).populate('creator').populate('comments').populate('comments.creator').exec(function(err, posts) {
      if (err) {
        json.unhappy(err, res);
      } else {
        posts.map(function(e) {
          e = e.afterSave(req.user);
        });
        json.happy({
          records: posts
        }, res);
      }
    });
  };

  /**
   * Get posts from users being followed
   * @param  {Object} req The request object
   * @param  {Object} res The response object
   * @return {Void}
   */
  obj.feed = function(req, res) {
    //TODO: pagination
    var user = req.user;
    var criteria = { creator: { $in: user.following.concat(user._id) } };
    if (req.query && req.query.timestamp) {
      criteria.created = { $gte: req.query.timestamp };
    }
    Post.find(criteria, null, {sort: {created: -1}}).populate('creator').populate('comments').populate('comments.creator').exec(function(err, posts) {
      if (err) {
        json.unhappy(err, res);
      } else {

        posts.map(function(e) {
          e = e.afterSave(req.user);
        });

        json.happy({
          records: posts
        }, res);
      }
    });
  };

  /**
   * Get a single post
   * @param  {Object} req Request
   * @param  {Object} res Response
   * @return {Void}
   */
  obj.single = function(req, res) {
    Post.findOne({
      _id: req.params.postId
    })
    .populate('creator').populate('comments').populate('comments.creator').exec(function(err, post) {
      if (err) {
        return json.unhappy(err, res);
      } else if (post) {
        post = post.afterSave(req.user);
        return json.happy({
          record: post
        }, res);
      } else {
        return json.unhappy({message: 'Post not found'}, res);
      }
    });
  };

  /**
   * Like a post
   * @param  {Object} req Request
   * @param  {Object} res Response
   * @return {Void}
   */
  obj.like = function(req, res) {
    Post.findOne({_id: req.params.postId}).populate('creator').populate('comments').populate('comments.creator').exec(function(err, post) {
      if (err) {
        return json.unhappy(err, res);
      } else if (post) {
        if (post.likes.indexOf(req.user._id) !== -1) {
          return json.unhappy('You have already liked the post', res);
        }
        post.likes.push(req.user._id);
        post.save(function(err, item) {
          post = post.afterSave(req.user);
          event.trigger('like', {post: post, actor: req.user});
          if (err) {
            return json.unhappy(err, res);
          }
          json.happy({
            record: item
          }, res);
        });
        
      } else {
        return json.unhappy({message: 'Post not found'}, res);
      }
    });
  };

  /**
   * unLike a post
   * @param  {Object} req Request
   * @param  {Object} res Response
   * @return {Void}
   */
  obj.unlike = function(req, res) {
    Post.findOne({_id: req.params.postId}).populate('creator').populate('comments').populate('comments.creator').exec(function(err, post) {
      if (err) {
        return json.unhappy(err, res);
      } else if (post) {
        if (post.likes.indexOf(req.user._id) !== -1) {
          post.likes.splice(post.likes.indexOf(req.user._id), 1);
          post.save(function(err, item) {
            post = post.afterSave(req.user);
            event.trigger('unlike', {post: post, actor: req.user});
            if (err) {
              return json.unhappy(err, res);
            }
            return json.happy({
              record: item
            }, res);
          });
        } else {
          return json.unhappy('You have not yet liked the post', res);
        }
        
      } else {
        return json.unhappy({message: 'Post not found'}, res);
      }
    });
  };



  return obj;
};