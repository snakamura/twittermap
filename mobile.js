$(document).delegate('#page-map', 'pagecreate', function() {
    var height = $(window).height() - ($(this).find('[data-role="header"]').height() +
                                       $(this).find('[data-role="footer"]').height());
    $('#map').height(height);

    var options = {
        center: new google.maps.LatLng(35.682085, 139.766221),
        zoom: 14,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    var map = new google.maps.Map($('#map')[0], options);
});
