'use strict';

angular.module('atwork.chats')
  .controller('ChatsCtrl', [
    '$scope',
    '$rootScope',
    '$routeParams',
    '$timeout',
    'appAuth',
    'appToast',
    'appStorage',
    'appLocation',
    'appWebSocket',
    'appChats',
    'appDialog',
    'appDesktop',
    function($scope, $rootScope, $routeParams, $timeout, appAuth, appToast, appStorage, appLocation, appWebSocket, appChats, appDialog, appDesktop) {
      $scope.chats = [];
      $scope.actions = {};

      /**
       * Open a new conversation
       * @return {Void}
       */
      $scope.message = function(ev, profile, chatItem) {
        var criteria;

        if (chatItem) {
          criteria = {
            chatId: chatItem._id
          };
        } else {
          criteria = {
            participants: [
              profile._id,
              appAuth.getUser()._id
            ]
          }
        }
        chatItem.unread = 0;

        var chat = new appChats.single(criteria);

        chat.$save(function(response) {

          /**
           * Show dialog
           */
          appDialog.show({
            controller: [
              '$scope',
              'appDialog',
              function($scope, appDialog) {
                /**
                 * Assign likers to the users variable
                 * @type {Array}
                 */
                $scope.messages = response.res.record.messages;

                $scope.chatId = response.res.record._id;
                $scope.firstTime = true;

                $scope.$on('chatMessage', function(e, data) {
                  $scope.$apply(function() {
                    $scope.messages.unshift(data.chatMessage);
                  });
                });

                /**
                 * Hide the dialog
                 * @return {Void}
                 */
                $scope.hide = function() {
                  appDialog.hide();
                };

                $scope.sendMessage = function(isValid) {
                  chatItem.unread = 0;
                  if (isValid) {
                    var message = $scope.message;
                    $scope.message = '';
                    appChats.single.message({
                      message: message,
                      creator: appAuth.getUser()._id,
                      _id: $scope.chatId
                    }, function(response) {
                      $scope.messages.unshift(response.res.record.messages[0]);
                    });
                  }
                };
              }
            ],
            templateUrl: '/modules/chats/views/chat-dialog.html',
            targetEvent: ev,
          });

        });
      };

      $scope.updateChats = function (options) {
        options = options || {};
        var chatsData = appChats.single.get({}, function() {
          /**
           * Check if the feed needs to reload
           */
          if (options.reload) {
            $scope.chats = [];
          }

          /**
           * Check whether to append to feed (at bottom) or insert (at top)
           */
          if (chatsData.res.records.length) {
            if (!options.append) {
              $scope.chats = chatsData.res.records.concat($scope.chats);
            } else {
              $scope.chats = $scope.chats.concat(chatsData.res.records);
            }
          }

          /**
           * Update badge
           */
          var messagesCount = 0;
          _.each($scope.chats, function(chat) {
            messagesCount += chat.unread;
          })
          appDesktop.notify({messagesCount: messagesCount});

          /**
           * Check if there are more pages
           * @type {Boolean}
           */
          $scope.noMoreChats = !chatsData.res.morePages;

          /**
           * Set the updated timestamp
           */
          $scope.lastUpdated = Date.now();
        });
      };

      $scope.$on('chatMessage', function(e, data) {
        var exists = false;
        _.each($scope.chats, function(chat) {
          if (chat._id === data.chatId) {
            exists = true;
          }
        });

        $scope.updateChats({reload: true});
      });

    }
  ])
  ;
