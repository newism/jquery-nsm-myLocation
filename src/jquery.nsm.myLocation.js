;
(function ($, window, document, Cookies, undefined) {

    /**
     * MyLocation Reverse Geocode Widget
     */
    $.widget('nsm.myLocation', {

        /**
         * Options
         */
        options: {
            autoexec: true,
            regionBias: 'AU',
            targetGeoResult: 'locality',
            cookieNameLatLng: 'myLocationLatLng',
            cookieNameText: 'myLocationText',
            cookieNamePromptShown: 'myLocationPromptShown',
            selectors: {
                distancePlaceholder: '.js-myLocation-distance',
                currentLatitudeInput: '.js-myLocation-currentLatitude',
                currentLongitudeInput: '.js-myLocation-currentLongitude',
                currentLatLngInput: '.js-myLocation-currentLatLng',
                formContainer: '.js-myLocation-form',
                updateTrigger: '.js-myLocation-trigger',
                locationText: '.js-myLocation-location'
            },
            classes: {
                distancePlaceholderActive: 'is-active'
            },
            lang: {
                updateLocationText: 'Update',
                distanceSuffix: ' K',
                reverseGeocodeFailurePromptUserInput: 'Sorry, we weren\'t able to detect your location. Would you like to enter a suburb or postcode instead?',
                reverseGeocodeFailureMatchingUserInput: 'Sorry, we couldn\'t find any places matching your input. Would you like to enter another suburb or postcode?'
            }
        },

        /**
         * Create the widget
         * @private
         */
        _create: function () {

            var widget = this,
                eventHandlers = {},
                myLocation,
                coords;

            widget.options = $.extend(widget.options, widget.element.data('myLocation'));

            widget.$updateTrigger = widget.element.find(widget.options.selectors.updateTrigger);
            widget.$locationText = widget.element.find(widget.options.selectors.locationText);

            eventHandlers['click ' + widget.options.selectors.updateTrigger] = '_handleUpdateBtnClick';
            eventHandlers['mylocationlocationchanged'] = '_handleLocationChanged';

            widget._on(eventHandlers);

            coords = widget._getCookieCoords();

            // cookie not set? autoexec if configured in the options
            if (true === widget.options.autoexec) {

                // we have coordinates that we can use
                if (coords.length > 1) {
                    // update the text location
                    widget._trigger('locationchanged', event, { coords: coords, location: null });
                } else {
                    // no coordinates stored in the cookie so attempt to autodetect
                    widget.updateLocation();
                }
            }


        },

        render: function(target) {
            var widget = this,
                jqTarget = (target ? $(target) : widget.element),
                jqDistancePlaceholders = jqTarget.find(widget.options.selectors.distancePlaceholder),
                jqCurrentLatitudeInputs = jqTarget.find(widget.options.selectors.currentLatitudeInput),
                jqCurrentLongitudeInputs = jqTarget.find(widget.options.selectors.currentLongitudeInput),
                jqCurrentLatLngInputs = jqTarget.find(widget.options.selectors.currentLatLngInput),
                jqLocationText = jqTarget.find(widget.options.selectors.locationText),
                jqUpdateTrigger = jqTarget.find(widget.options.selectors.updateTrigger),
                coords = widget._getCookieCoords(),
                currentLocationString = widget._getCookieLocationString();

            // not a valid coords object? exit
            if (false === coords) {
                return;
            }

            // update the text contents of the distance placeholders
            jqDistancePlaceholders.each(function() {
                widget._renderDistancePlaceholder(this, coords);
            });

            // find all inputs that need to be updated with the current latitude
            jqCurrentLatitudeInputs.each(function() {
                $(this).val(coords.latitude);
            });

            // find all inputs that need to be updated with the current longitude
            jqCurrentLongitudeInputs.each(function() {
                $(this).val(coords.longitude);
            });

            // find all inputs that need to be updated with the current longitude
            jqCurrentLatLngInputs.each(function() {
                $(this).val(coords.latitude + '|' + coords.longitude);
            });

            // update the placeholders for the user location
            jqLocationText.val(currentLocationString).text(currentLocationString);

            // update the text value of the update trigger
            jqUpdateTrigger.text(widget.options.lang.updateLocationText);
        },

        _handleLocationChanged: function(event) {
            var widget = this;

            // render the widget
            widget.render(event.target);
        },

        // process the Update Location button click
        _handleUpdateBtnClick: function(event) {
            var widget = this;

            // prevent normal behaviour so our handler can function
            event.preventDefault();

            // call the function that does the heavy lifting and send the event
            widget.updateLocation(event);
        },

        // public function to update the user's location
        updateLocation: function(event) {
            var widget = this,
                geocoder = new google.maps.Geocoder;

            // exit early if the browser didn't give permission to find the location
            if (!navigator.geolocation) {
                window.alert('Geolocation is not supported by your browser');

                return;
            }

            // define the callback that will handle the user's location from the browser
            var success = function(position) {

                // prep our variables
                var coords = {
                        latitude: parseFloat(position.coords.latitude),
                        longitude: parseFloat(position.coords.longitude),
                        length: 2
                    };

                // reverse-geocode the user's location to find their current address
                geocoder.geocode({
                    location: {
                        lat: coords.latitude,
                        lng: coords.longitude
                    },
                    region: widget.options.regionBias
                }, function (results, status) {

                    // the geocode was successful
                    if (status === google.maps.GeocoderStatus.OK) {
                        // find the result matching our targeted specificity
                        var targetResult = widget._getTargetResult(results);

                        // we got one, now process it
                        if (targetResult) {

                            // we can fetch the formatted_address as we know how specific we want to be
                            var addressString = targetResult.formatted_address;

                            // update the city name in the cookie
                            widget._setCookieLocationString(addressString);

                            // fire an event for the place change
                            widget._trigger('locationchanged', event, { coords: coords, location: targetResult });

                        } else {
                            // no result matched the targeted criteria
                            window.alert('No results found');
                        }

                    } else {
                        // the geocoder returned an error
                        window.alert('Geocoder failed due to: ' + status);
                    }
                });

                // update the label for the trigger
                widget.$updateTrigger.text(widget.options.lang.updateLocationText);

                // update the cookie
                widget._setCookieCoords(coords);

                // fire an event for the lat/lng change
                widget._trigger('locationchanged', event, { coords: coords, location: null });
            };

            // define an error handler if the browser prevents access to the location
            var error = function() {

                var userInput = false,
                    coords = false,
                    getLatLngForUserInput = function(userInputParam) {
                        // give the user the option to specify a post code instead
                        geocoder.geocode({
                            address: userInputParam,
                            region: widget.options.regionBias
                        }, function (results, status) {

                            // the geocode was successful
                            if (status === google.maps.GeocoderStatus.OK) {
                                // find the result matching our targeted specificity
                                var targetResult = widget._getTargetResult(results);

                                // we got one, now process it
                                if (targetResult) {

                                    // prepare the new coordinates object
                                    coords = {
                                        latitude: targetResult.geometry.location.lat(),
                                        longitude: targetResult.geometry.location.lng(),
                                        length: 2
                                    };

                                    // this part differs from normal success method - save coordinates back to the cookie
                                    widget._setCookieCoords(coords);

                                    // we can fetch the formatted_address as we know how specific we want to be
                                    var addressString = targetResult.formatted_address;

                                    // update the city name in the cookie
                                    widget._setCookieLocationString(addressString);

                                    // fire an event for the place change
                                    widget._trigger('locationchanged', event, { coords: coords, location: targetResult });

                                } else {
                                    // no result matched the targeted criteria
                                    window.alert('No results found');
                                }

                            } else {
                                // the geocoder returned an error
                                userInput = window.prompt(widget.options.lang.reverseGeocodeFailureMatchingUserInput);

                                // if a value was supplied then try and geocode it
                                if (userInput) {
                                    getLatLngForUserInput(userInput);
                                }
                            }
                        });
                    };

                // is this an eventless action and has the user already been asked for their location? if so exit
                if (undefined === event && true === widget._getCookieLocationPromptShown()) {

                    return;
                }

                // capture the suburb or postcode that the user enters
                userInput = window.prompt(widget.options.lang.reverseGeocodeFailurePromptUserInput);

                // if a value was supplied then try and geocode it
                if (userInput) {
                    getLatLngForUserInput(userInput);
                }

                // write a cookie to remember that the user input prompt was shown
                widget._setCookieLocationPromptShown(true);
            };

            // go forth and process the user location
            navigator.geolocation.getCurrentPosition(success, error);
        },

        calculateDistance: function(originLat, originLng, destLat, destLng) {
            var distance, theta, miles, kilometers, deg2rad, rad2deg;

            // https://github.com/mrdoob/three.js/issues/8471
            deg2rad = function (degrees) {
                // Math.PI / 360 = 0.008726646259971648
                return degrees * 0.008726646259971648;
            };
            rad2deg = function (radians) {
                // 360 / Math.PI = 114.59155902616465
                return radians * 114.59155902616465;
            };

            theta = originLng - destLng;
            distance = Math.sin(deg2rad(originLat)) * Math.sin(deg2rad(destLat)) +  Math.cos(deg2rad(originLat)) * Math.cos(deg2rad(destLat)) * Math.cos(deg2rad(theta));
            distance = Math.acos(distance);
            distance = rad2deg(distance);
            miles = distance * 60 * 1.1515;
            kilometers = miles * 1.609344;

            return kilometers;
        },

        _renderDistancePlaceholder: function(placeholderEl, coords) {
            var widget = this,
                jqEl = $(placeholderEl),
                objLat = jqEl.data('latitude'),
                objLng = jqEl.data('longitude'),
                distance = widget.calculateDistance(objLat, objLng, coords.latitude, coords.longitude),
                approxDistance = (distance < 100) ? distance.toFixed(1) : Math.round(distance);

            // update the distance text
            jqEl.text(approxDistance + widget.options.lang.distanceSuffix);

            // add the class so that we know its been updated
            jqEl.addClass(widget.options.classes.distancePlaceholderActive);
        },

        // get the latidude/longitude from the cookie
        _getCookieCoords: function() {
            var widget = this,
                latlng = unescape(Cookies.get(widget.options.cookieNameLatLng)),
                parts = latlng.split('|');

            // not enough parts to make a latitude/longitude pair
            if (parts.length < 2) {

                return false;
            }

            // return an object storing the coordinates
            return {
                latitude: parts[0],
                longitude: parts[1],
                length: 2
            };
        },

        // set the coordinates to the cookie
        _setCookieCoords: function(coords) {
            var widget = this,
                latlng = escape(coords.latitude + '|' + coords.longitude);

            Cookies.set(widget.options.cookieNameLatLng, latlng);
        },

        // get the location string from the cookie
        _getCookieLocationString: function() {
            var widget = this,
                locationString = unescape(Cookies.get(widget.options.cookieNameText));

            return locationString;
        },

        // set the location back to the cookie
        _setCookieLocationString: function(locationString) {
            var widget = this;

            Cookies.set(widget.options.cookieNameText, locationString);
        },

        // get the status of the location prompt from the cookie
        _getCookieLocationPromptShown: function() {
            var widget = this,
                cookieValue = unescape(Cookies.get(widget.options.cookieNamePromptShown)),
                promptShownStatus = (cookieValue > 0 ? true : false);

            return promptShownStatus;
        },

        // set the status of the location prompt to the cookie
        _setCookieLocationPromptShown: function(promptShownStatus) {
            var widget = this,
                storeValue = (true === promptShownStatus ? 1 : 0);

            Cookies.set(widget.options.cookieNamePromptShown, storeValue);
        },

        /**
         * Parse the address components into something more reasonable
         *
         * @param addressComponents
         * @returns {{}}
         * @private
         */
        _parseAddressComponents: function (addressComponents) {

            var geocoded = {
                streetNumber: '',
                route: '',
                locality: '',
                administrativeAreaLevel1: '',
                administrativeAreaLevel1Code: '',
                postalCode: '',
                country: '',
                countryCode: ''
            };

            for (var i in addressComponents) {
                for (var j in addressComponents[i].types) {
                    switch (addressComponents[i].types[j]) {
                        case 'street_number':
                            geocoded.streetNumber = addressComponents[i].long_name;
                            break;
                        case 'route':
                            geocoded.route = addressComponents[i].long_name;
                            break;
                        case 'locality':
                            geocoded.locality = addressComponents[i].long_name;
                            break;
                        case 'administrative_area_level_1':
                            geocoded.administrativeAreaLevel1 = addressComponents[i].long_name;
                            geocoded.administrativeAreaLevel1Code = addressComponents[i].short_name;
                            break;
                        case 'postal_code':
                            geocoded.postalCode = addressComponents[i].long_name;
                            break;
                        case 'country':
                            geocoded.country = addressComponents[i].long_name;
                            geocoded.countryCode = addressComponents[i].short_name;
                            break;
                    }
                }
            }

            return geocoded;
        },

         // get the preferred result from the array
        _getTargetResult: function(results) {
            var widget = this;

            // return false if no results came back
            if (0 === results.length) {

                return false;
            }

            // iterate and find the result we want
            for (var i in results) {
                // if the address matches the targeted type then use it
                if (results[i].types.indexOf(widget.options.targetGeoResult) > -1) {
                    return results[i];
                }
            }

            // return the first result if no others were selected earlier
            return results[0];
        }

    });

})(jQuery, window, document, Cookies);
