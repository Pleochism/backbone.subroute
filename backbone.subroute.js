// backbone-subroute.js v0.4.3
//
// Copyright (C) 2012 Dave Cadwallader, Model N, Inc.
// Distributed under the MIT License
//
// Documentation and full license available at:
// https://github.com/ModelN/backbone.subroute

(function(factory) {
    if (typeof define === 'function' && define.amd) {
        // Register as an AMD module if available...
        define(['underscore', 'backbone'], factory);
    } else if (typeof exports === 'object') {
        // Next for Node.js, CommonJS, browserify...
        factory(require('underscore'), require('backbone'));
    } else {
        // Browser globals for the unenlightened...
        factory(_, Backbone);
    }
}(function(_, Backbone) {

    var nop = function(){};

    Backbone.SubRoute = Backbone.Router.extend({
        constructor: function(prefix, options) {

            // each subroute instance should have its own routes hash
            this.routes = _.clone(this.routes) || {};

            // Prefix is optional, set to empty string if not passed
            this.prefix = prefix = prefix || "";

            // SubRoute instances may be instantiated using a prefix with or without a trailing slash.
            // If the prefix does *not* have a trailing slash, we need to insert a slash as a separator
            // between the prefix and the sub-route path for each route that we register with Backbone.
            this.separator = (prefix.slice(-1) === "/") ? "" : "/";

            // if you want to match "books" and "books/" without creating separate routes, set this
            // option to "true" and the sub-router will automatically create those routes for you.
            this.createTrailingSlashRoutes = options && options.createTrailingSlashRoutes;

            // Required to have Backbone set up routes
            Backbone.Router.prototype.constructor.call(this, options);

            // grab the full URL
            var hash;
            if (Backbone.history.fragment) {
                hash = Backbone.history.getFragment();
            } else {
                hash = Backbone.history.getHash();
            }

            // Trigger the subroute immediately.  this supports the case where
            // a user directly navigates to a URL with a subroute on the first page load.
            // Check every element, if one matches, break. Prevent multiple matches
            _.every(this.routes, function(key, route) {
                // Use the Backbone parser to turn route into regex for matching
                if (hash.match(Backbone.Router.prototype._routeToRegExp(route))) {
                    Backbone.history.loadUrl(hash);
                    return false;
                }
                return true;
            }, this);

            if (this.postInitialize) {
                this.postInitialize(options);
            }
        },
        navigate: function(route, options) {
            if (route.substr(0, 1) != '/' &&
                route.indexOf(this.prefix.substr(0, this.prefix.length - 1)) !== 0) {

                route = this.prefix +
                    (route ? this.separator : "") +
                    route;
            }
            Backbone.Router.prototype.navigate.call(this, route, options);
        },

        // Pave over Backbone.Router.prototype.route, the public method used
        // for adding routes to a router instance on the fly, and the
        // method which backbone uses internally for binding routes to handlers
        // on the Backbone.history singleton once it's instantiated.
        route: function(route, name, callback) {

            //console.log("Routing", route, name, callback);
          // If there is no callback present for this route, then set it to
          // be the name that was set in the routes property of the constructor,
          // or the name arguement of the route method invocation. This is what
          // Backbone.Router.route already does. We need to do it again,
          // because we are about to wrap the callback in a function that calls
          // the before and after filters as well as the original callback that
          // was passed in.
          if( !callback ){
            callback = this[ name ];
          }

          // Create a new callback to replace the original callback that calls
          // the before and after filters as well as the original callback
          // internally.
          var wrappedCallback = function() {

            // Call the before filter and if it returns false, run the
            // route's original callback, and after filter. This allows
            // the user to return false from within the before filter
            // to prevent the original route callback and after
            // filter from running.
            var callbackArgs = [ route, _.toArray(arguments) ];
            var beforeCallback;

            if ( _.isFunction(this.before) ) {

              // If the before filter is just a single function, then call
              // it with the arguments.
              beforeCallback = this.before;
            } else if ( typeof this.before[route] !== "undefined" ) {

              // otherwise, find the appropriate callback for the route name
              // and call that.
              beforeCallback = this.before[route];
            } else {

              // otherwise, if we have a hash of routes, but no before callback
              // for this route, just use a nop function.
              beforeCallback = nop;
            }

            // If the before callback fails during its execusion (by returning)
            // false, then do not proceed with the route triggering.
            if ( beforeCallback.apply(this, callbackArgs) === false ) {
              return;
            }

            // If the callback exists, then call it. This means that the before
            // and after filters will be called whether or not an actual
            // callback function is supplied to handle a given route.
            if( callback ) {
              callback.apply( this, arguments );
            }

            var afterCallback;
            if ( _.isFunction(this.after) ) {

              // If the after filter is a single funciton, then call it with
              // the proper arguments.
              afterCallback = this.after;

            } else if ( typeof this.after[route] !== "undefined" ) {

              // otherwise if we have a hash of routes, call the appropriate
              // callback based on the route name.
              afterCallback = this.after[route];

            } else {

              // otherwise, if we have a has of routes but no after callback
              // for this route, just use the nop function.
              afterCallback = nop;
            }

            // Call the after filter.
            afterCallback.apply( this, callbackArgs );

          }.bind(this);

          // Call our original route, replacing the callback that was originally
          // passed in when Backbone.Router.route was invoked with our wrapped
          // callback that calls the before and after callbacks as well as the
          // original callback.
          return this.subroute.call( this, route, name, wrappedCallback );
        },

        subroute: function(route, name, callback) {
            // strip off any leading slashes in the sub-route path,
            // since we already handle inserting them when needed.
            if (route.substr(0) === "/") {
                route = route.substr(1, route.length);
            }

            var _route = this.prefix;
            if (route && route.length > 0) {
                if (this.prefix.length > 0)
                    _route += this.separator;

                _route += route;
            }

            if (this.createTrailingSlashRoutes) {
                this.routes[_route + '/'] = name;
                Backbone.Router.prototype.route.call(this, _route + '/', name, callback);
            }

            // remove the un-prefixed route from our routes hash
            delete this.routes[route];

            // add the prefixed-route.  note that this routes hash is just provided
            // for informational and debugging purposes and is not used by the actual routing code.
            this.routes[_route] = name;

            // delegate the creation of the properly-prefixed route to Backbone
            return Backbone.Router.prototype.route.call(this, _route, name, callback);
        }
    });
    return Backbone.SubRoute;
}));
