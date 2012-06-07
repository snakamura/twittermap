var INSERT_INTERVAL = 1*1000;
var UPDATE_INTERVAL = 60*1000;
var UPDATE_CREATED_INTERVAL = 60*1000;
var UPDATE_DELAY = 1*1000;

function adjustMapHeight() {
    var height = window.innerHeight - ($(document).find('[data-role="header"]').height() +
                                       $(document).find('[data-role="footer"]').height());
    $('#map').height(height);
};

$(document).delegate('#page-map', 'pageshow', function() {
    adjustMapHeight();
});

$(document).delegate('#page-map', 'pagecreate', function() {
    $(window).resize(function() {
        adjustMapHeight();
    });
    $('#button_map').click(function() {
        $('#map').show();
        $('#tweets').hide();
        $(document).scrollTop(0);
        adjustMapHeight();
    });
    $('#button_tweets').click(function() {
        $('#tweets').show();
        $('#map').hide();
    });

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

    var location = new Location(map);

    var go = function() {
        location.go($('#loc').val());
    };
    $('#loc').live('keydown', function(event) {
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
    $(location).bind('tracking_changed', function() {
        $('#home').val(location.isTracking() ? 1 : 0).slider('refresh');
    });

    var tweets = new Tweets(map);
    $(tweets).bind('tweet_added', function(event, tweet, map, marker) {
        var element = tweet.createElement();
        $('#tweets').prepend(element);
        element.wrap('<li />');
        $('#tweets').listview('refresh');
        tweet.element = element;
    });
    $(tweets).bind('tweet_removed', function(event, tweet) {
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
