var INSERT_INTERVAL = 1*1000;
var UPDATE_INTERVAL = 60*1000;
var UPDATE_CREATED_INTERVAL = 60*1000;
var UPDATE_DELAY = 1*1000;

$(function() {
    var options = {
        center: new google.maps.LatLng(35.682085, 139.766221),
        zoom: 14,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    var map = new google.maps.Map($('#map')[0], options);

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

    $('button').button();
    $('input:checkbox').button();

    var location = new Location(map);

    var go = function() {
        location.go($('#loc').val());
    };
    $('#go').click(go);
    $('#loc').keydown(function(event) {
        if (event.keyCode == 13) {
            go();
            event.target.blur();
        }
    });

    $('#home').change(function() {
        if (!location.isTracking())
            location.startTracking();
        else
            location.stopTracking();
    });
    $(location).on('tracking_changed', function() {
        $('#home').prop('checked', location.isTracking()).button('refresh');
    });

    var tweets = new Tweets(map);
    $(tweets).on('tweet_added', function(event, tweet, map, marker) {
        var element = tweet.createElement();
        element.mouseenter(function(event) {
            marker.setAnimation(google.maps.Animation.BOUNCE);
        });
        element.mouseleave(function(event) {
            marker.setAnimation(null);
        });
        element.click(function(event) {
            var position = marker.getPosition();
            if (!map.getBounds().contains(position))
                map.setCenter(position);
        });

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
        google.maps.event.addListener(marker, 'click', function(event) {
            sidebar.animate({
                'scrollTop': (sidebar.scrollTop() + element.position().top - 20) + 'px'
            }, 'fast');
        });

        tweet.element = element;
    });
    $(tweets).on('tweet_removed', function(event, tweet) {
        tweet.element.remove();
    });

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
            tweet.updateCreated(tweet.element, now);
        });
    }, UPDATE_CREATED_INTERVAL);
});
