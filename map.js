var map = null;
var infoWindow = null;
var tweets = {};
var updateTimer = null;
var lastUpdated = null;

var UPDATE_INTERVAL = 10;

$(function() {
    var options = {
        center: new google.maps.LatLng(35.607103, 139.734893),
        zoom: 16,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map($('#map')[0], options);

    navigator.geolocation.getCurrentPosition(function(position) {
        map.setCenter(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
    });

    google.maps.event.addListener(map, 'bounds_changed', function(event) {
        update();
    });
});

function update() {
    if (!updateTimer) {
        var now = new Date();
        if (!lastUpdated) {
            insertTweets();
            lastUpdated = now;
        }
        else {
            var diff = now.getTime() - lastUpdated.getTime();
            if (diff > UPDATE_INTERVAL) {
                insertTweets();
                lastUpdated = now;
            }
            else {
                updateTimer = setTimeout(function() {
                    updateTimer = null;
                    insertTweets();
                    lastUpdated = new Date();
                }, (UPDATE_INTERVAL - diff)*1000);
            }
        }
    }
}

function insertTweets() {
    var position = map.getCenter();
    var script = $('<script/>');
    script.attr('type', 'text/javascript');
    script.attr('src', 'http://search.twitter.com/search.json?geocode=' + position.toUrlValue() + ',1km&rpp=100&include_entities=t&result_type=recent&callback=processTweets');
    $('body').append(script);
}

function insertTweet(tweet, position) {
    if (tweets[tweet.id])
        return;

    var icon = new google.maps.MarkerImage(tweet.profile_image_url,
                                           new google.maps.Size(48, 48));
    var shadow = new google.maps.MarkerImage('shadow.png',
                                             new google.maps.Size(64, 64),
                                             new google.maps.Point(0, 0),
                                             new google.maps.Point(24, 48));
    var marker = new google.maps.Marker({
        map: map,
        position: position,
        title: tweet.text,
        icon: icon,
        shadow: shadow
    });

    var t = createTweetElement(tweet);
    t.hide();
    t.mouseenter(function(event) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
    });
    t.mouseleave(function(event) {
        marker.setAnimation(null);
    });
    t.click(function(event) {
        var position = marker.getPosition();
        if (!map.getBounds().contains(position))
            map.setCenter(position);
    });

    $('#tweets').prepend(t);
    t.animate({
        height: 'show'
    });

    google.maps.event.addListener(marker, 'mouseover', function(event) {
        t.addClass('highlighted');
    });
    google.maps.event.addListener(marker, 'mouseout', function(event) {
        t.removeClass('highlighted');
    });
    google.maps.event.addListener(marker, 'click', function(event) {
        showTweet(tweet, marker);

        var sidebar = $('#sidebar');
        sidebar.animate({
            'scrollTop': (sidebar.scrollTop() + t.position().top - 20) + 'px'
        }, 'fast');
    });

    tweets[tweet.id] = tweet;
}

function createTweetElement(tweet) {
    var t = $('<div class="tweet"><img class="profile"/><div><a class="username"/> <a class="user"/></div><div class="text"/></div>');
    t.children('img.profile').attr('src', tweet.profile_image_url);
    var links = [t.find('a.username').text(tweet.from_user_name),
                 t.find('a.user').text(tweet.from_user)];
    $.each(links, function(n, l) {
        l.attr('href', 'http://twitter.com/#!' + tweet.from_user).attr('target', '_blank');
    });
    t.children('div.text').html(formatTweet(tweet));
    if (tweet.entities.media) {
        $.each(tweet.entities.media, function(n, media) {
            var thumb = $('<img class="thumb"/>');
            thumb.attr('src', media.media_url + ':thumb');
            thumb.css('width', media.sizes.thumb.w + 'px');
            thumb.css('height', media.sizes.thumb.h + 'px');
            t.append(thumb);
        });
    }
    return t;
}

function formatTweet(tweet) {
    var escape = function(t) {
        // TODO
        // This method doesn't escape '"'.
        return $('<div/>').text(t).html();
    };

    var URL = 0;
    var USER_MENTION = 1;
    var HASHTAG = 2;

    var types = [{ type: URL,          entities: tweet.entities.urls          },
                 { type: USER_MENTION, entities: tweet.entities.user_mentions },
                 { type: HASHTAG,      entities: tweet.entities.hashtags      }];
    var entities = [];
    $.each(types, function(n, t) {
        if (t.entities) {
            $.each(t.entities, function(n, e) {
                e.type = t.type;
            });
            entities = entities.concat(t.entities);
        }
    });
    entities.sort(function(e1, e2) {
        return e1.indices[0] - e2.indices[0];
    });

    var formatted = '';
    var text = tweet.text;
    var current = 0;
    $.each(entities, function(n, e) {
        var start = e.indices[0];
        formatted += escape(text.substring(current, start));
        switch (e.type) {
        case URL:
            formatted += '<a href="' + escape(e.url) + '" target="_blank">' + escape(e.display_url) + '</a>';
            break;
        case USER_MENTION:
            formatted += '<a href="http://twitter.com/#!' + escape(encodeURIComponent(e.screen_name)) + '" title="' + escape(e.name) + '" target="_blank">@' + escape(e.screen_name) + '</a>';
            break;
        case HASHTAG:
            formatted += '<a href="http://twitter.com/#!search/' + escape(encodeURIComponent('#' + e.text)) + '" target="_blank">#' + escape(e.text) + '</a>';
            break;
        }
        current = e.indices[1];
    });
    formatted += escape(text.substring(current));
    return formatted;
}

function showTweet(tweet, marker) {
    if (infoWindow)
        infoWindow.close();

    var options = {
        content: createTweetElement(tweet)[0],
        maxWidth: 320
    };
    infoWindow = new google.maps.InfoWindow(options);
    infoWindow.open(map, marker);
}

function processTweets(response) {
    if (response.error) {
        alert(response.error);
        return;
    }

    $.each(response.results, function(n, tweet) {
        if (tweet.geo) {
            insertTweet(tweet, new google.maps.LatLng(tweet.geo.coordinates[0], tweet.geo.coordinates[1]));
        }
        else if (tweet.location) {
            var geocoder = new google.maps.Geocoder();
            var request = {
                address: tweet.location
            };
            geocoder.geocode(request, function(result, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    insertTweet(tweet, result[0].geometry.location);
                }
            });
        }
    });
}
