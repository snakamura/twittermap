var Tweets = function(map) {
    this.map = map;
    this.tweets = {};
    this.tweetIds = [];
    this.infoWindow = null;
};

Tweets.MAX_TWEETS = 100;

Tweets.prototype.each = function(f) {
    var tweets = this.tweets;
    $.each(tweets, function(id) {
        f(tweets[id]);
    });
};

Tweets.prototype.hasTweet = function(tweet) {
    return tweet.id in this.tweets;
};

Tweets.prototype.insertTweet = function(tweet, position) {
    if (this.hasTweet(tweet))
        return false;

    if (!this.map.getBounds().contains(position))
        return false;

    var icon = new google.maps.MarkerImage(tweet.profile_image_url,
                                           new google.maps.Size(48, 48));
    var shadow = new google.maps.MarkerImage('shadow.png',
                                             new google.maps.Size(64, 64),
                                             new google.maps.Point(0, 0),
                                             new google.maps.Point(24, 48));
    var marker = new google.maps.Marker({
        map: this.map,
        position: position,
        title: tweet.text,
        icon: icon,
        shadow: shadow
    });

    var element = tweet.createElement();
    element.mouseenter(function(event) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
    });
    element.mouseleave(function(event) {
        marker.setAnimation(null);
    });
    element.click($.proxy(function(event) {
        var position = marker.getPosition();
        if (!this.map.getBounds().contains(position))
            this.map.setCenter(position);
    }, this));

    $('#tweets').prepend(element);

    var sidebar = $('#sidebar');
    var scrollTop = sidebar.scrollTop();
    if (scrollTop == 0) {
        element.hide();
        element.show('blind', { mode: 'show' }, 'slow');
    }
    else {
        sidebar.scrollTop(scrollTop + element.outerHeight(true) + 1);
    }

    google.maps.event.addListener(marker, 'mouseover', function(event) {
        element.addClass('highlighted');
    });
    google.maps.event.addListener(marker, 'mouseout', function(event) {
        element.removeClass('highlighted');
    });
    google.maps.event.addListener(marker, 'click', $.proxy(function(event) {
        this.showTweet(tweet);

        var sidebar = $('#sidebar');
        sidebar.animate({
            'scrollTop': (sidebar.scrollTop() + element.position().top - 20) + 'px'
        }, 'fast');
    }, this));

    tweet.marker = marker;
    tweet.element = element;

    this.tweets[tweet.id] = tweet;
    this.tweetIds.push(tweet.id);

    this.crop();

    return true;
};

Tweets.prototype.crop = function() {
    while (this.tweetIds.length > Tweets.MAX_TWEETS) {
        var id = this.tweetIds.shift();
        var tweet = this.tweets[id];
        tweet.marker.setMap(null);
        tweet.element.remove();
        delete this.tweets[id];
    }
}

Tweets.prototype.showTweet = function(tweet) {
    if (this.infoWindow)
        this.infoWindow.close();

    var options = {
        content: tweet.createElement(tweet)[0],
        maxWidth: 320
    };
    this.infoWindow = new google.maps.InfoWindow(options);
    this.infoWindow.open(this.map, tweet.marker);
};


var Tweet = function() {
};

Tweet.prototype.createElement = function() {
    var t = $('<div class="tweet"><div class="tweet_container"><img class="profile"/><div class="created"/><div><a class="username"/> <a class="user"/></div><div class="text"/></div></div>');
    t.find('img.profile').attr('src', this.profile_image_url);
    this.applyCreated(t);
    var links = [t.find('a.username').text(this.from_user_name),
                 t.find('a.user').text(this.from_user)];
    $.each(links, $.proxy(function(n, l) {
        l.attr('href', 'http://twitter.com/#!' + this.from_user).attr('target', '_blank');
    },this));
    t.find('div.text').html(this.format());
    if (this.entities.media) {
        $.each(this.entities.media, function(n, media) {
            var thumb = $('<a target="blank"><img class="thumb"/></a>');
            thumb.attr('href', media.url);
            var img = thumb.children('img');
            img.attr('src', media.media_url + ':thumb');
            img.css('width', media.sizes.thumb.w + 'px');
            img.css('height', media.sizes.thumb.h + 'px');
            t.append(thumb);
        });
    }
    return t;
};

Tweet.prototype.updateCreated = function(now) {
    this.applyCreated(this.element, now);
};

Tweet.prototype.applyCreated = function(element, now) {
    element.find('div.created').text(Tweet.formatDate(new Date(this.created_at), now));
};

Tweet.prototype.format = function() {
    var escape = function(t) {
        // TODO
        // This method doesn't escape '"'.
        return $('<div/>').text(t).html();
    };

    var URL = 0;
    var USER_MENTION = 1;
    var HASHTAG = 2;
    var MEDIA = 3;

    var types = [{ type: URL,          entities: this.entities.urls          },
                 { type: USER_MENTION, entities: this.entities.user_mentions },
                 { type: HASHTAG,      entities: this.entities.hashtags      },
                 { type: MEDIA,        entities: this.entities.media         }];
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
    var text = this.text;
    var current = 0;
    $.each(entities, function(n, e) {
        var start = e.indices[0];
        formatted += escape(text.substring(current, start));
        switch (e.type) {
        case URL:
        case MEDIA:
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
};

Tweet.formatDate = function(date, now) {
    if (!now)
        now = new Date();
    var diff = (now.getTime() - date.getTime())/1000;
    if (diff < 1)
        return 'now';
    else if (diff < 60)
        return Math.floor(diff) + 's';
    else if (diff < 60*60)
        return Math.floor(diff/60) + 'm';
    else if (diff < 24*60*60)
        return Math.floor(diff/60/60) + 'h';
    else
        return Math.floor(diff/60/60/24) + 'd';
};


var Queue = function() {
    this.items = [];
};

Queue.prototype.enqueue = function(item) {
    this.items.unshift(item);
};

Queue.prototype.dequeue = function() {
    return this.items.length == 0 ? null : this.items.shift();
};

Queue.prototype.clear = function() {
    this.items.length = 0;
};


var QueueItem = function(tweet, position) {
    this.tweet = tweet;
    this.position = position;
};


var Updater = function(map, queue) {
    this.map = map;
    this.queue = queue;
    this.timer = null;
    this.lastUpdated = new Date(new Date().getTime() - Updater.INTERVAL);
    this.lastBounds = null;
    this.refreshUrl = null;
};

Updater.INTERVAL = 10;

Updater.prototype.update = function() {
    if (!this.timer) {
        var now = new Date();
        var diff = now.getTime() - this.lastUpdated.getTime();
        if (diff > Updater.INTERVAL) {
            this.updateTweets();
            this.lastUpdated = now;
        }
        else {
            this.timer = setTimeout($.proxy(function() {
                this.timer = null;
                this.updateTweets();
                this.lastUpdated = new Date();
            }, this), (Updater.INTERVAL - diff)*1000);
        }
    }
};

Updater.prototype.updateTweets = function() {
    var bounds = this.map.getBounds();
    var position = this.getPosition();
    var radius = this.getRadius();
    var url = 'http://search.twitter.com/search.json';
    if (this.lastBounds && bounds.equals(this.lastBounds)) {
        url += this.refreshUrl;
    }
    else {
        var since = new Date(new Date().getTime() - 24*60*60*1000);
        url += '?q=since:' + encodeURIComponent(Updater.formatUTCDate(since)) + '&geocode=' + encodeURIComponent(position.toUrlValue()) + ',' + radius + '&rpp=100&include_entities=t&result_type=recent';
    }
    url += '&callback=?';

    $.getJSON(url, $.proxy(function(response) {
        if (response.error) {
            alert(response.error);
            return;
        }

        var queue = this.queue;
        queue.clear();

        $.each(response.results, function(n, tweet) {
            $.extend(tweet, Tweet.prototype);

            if (tweet.geo) {
                queue.enqueue(new QueueItem(tweet, new google.maps.LatLng(tweet.geo.coordinates[0], tweet.geo.coordinates[1])));
            }
            else if (tweet.location) {
                var geocoder = new google.maps.Geocoder();
                var request = {
                    address: tweet.location
                };
                geocoder.geocode(request, function(result, status) {
                    if (status == google.maps.GeocoderStatus.OK) {
                        queue.enqueue(new QueueItem(tweet, result[0].geometry.location));
                    }
                });
            }
        });

        this.lastbounds = bounds;
        this.refreshUrl = response.refresh_url;
    }, this));
};

Updater.prototype.getPosition = function() {
    var center = this.map.getCenter();
    return new google.maps.LatLng(center.lat(), center.lng());
};

Updater.prototype.getRadius = function() {
    var center = this.map.getCenter();
    var bounds = this.map.getBounds();
    var span = bounds.toSpan();
    var r = 6400;
    return Math.max(Math.ceil(r*2*Math.PI/360*span.lat()/2), Math.ceil(r*Math.cos(center.lat()/180*Math.PI)*2*Math.PI/360*span.lng()/2)) + 'km';
};

Updater.formatUTCDate = function(date) {
    return date.getUTCFullYear() + '-' + (date.getUTCMonth() + 1) + '-' + date.getUTCDate();
};


var INSERT_INTERVAL = 1*1000;
var UPDATE_INTERVAL = 60*1000;
var UPDATE_CREATED_INTERVAL = 60*1000;
var UPDATE_DELAY = 1*1000;

$(function() {
    var options = {
        center: new google.maps.LatLng(35.607103, 139.734893),
        zoom: 16,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    var map = new google.maps.Map($('#map')[0], options);

    navigator.geolocation.getCurrentPosition(function(position) {
        map.setCenter(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
    });

    var queue = new Queue();
    var updater = new Updater(map, queue);

    var timer = null;
    google.maps.event.addListener(map, 'bounds_changed', function(event) {
        if (timer != null)
            clearTimeout(timer);
        timer = setTimeout(function() {
            timer = null;
            updater.update();
        }, UPDATE_DELAY);
    });

    setInterval(function() {
        updater.update();
    }, UPDATE_INTERVAL)

    var tweets = new Tweets(map);

    setInterval(function() {
        while (true) {
            var item = queue.dequeue();
            if (!item || tweets.insertTweet(item.tweet, item.position))
                break;
        }
    }, INSERT_INTERVAL);

    setInterval(function() {
        var now = new Date();
        tweets.each(function(tweet) {
            tweet.updateCreated(now);
        });
    }, UPDATE_CREATED_INTERVAL);
});
