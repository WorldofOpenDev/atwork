'use strict';

angular.module('atwork.streams')
  .factory('appStreams', ['$resource',
    function($resource) {
      return {
        single: $resource('streams/:streamId/:action', {
            postId: '@_id'
          }, {
            subscribe: {
              method: 'POST',
              params: {action: 'subscribe'}
            },
            unsubscribe: {
              method: 'POST',
              params: {action: 'unsubscribe'}
            }
          })
      }
    }
  ])
  ;
  