(function(){

    var $swipe1 = $('.swipe1');
    var swipe1 = new webit.swipe($swipe1.get(0), {
        direction: 'horizontal'
    })
        .on('move', function(t){
            $swipe1.html('swipe3 ' + t.offset.x)
        });


    var $swipe2 = $('.swipe2');
    var swipe2 = new webit.swipe($swipe2.get(0), {
        direction: 'horizontal'
    })
        .on('move', function(t){
            $swipe2.html('swipe3 ' + t.offset.x)
        })


    var $swipe3 = $('.swipe3');
    var swipe3 = new webit.swipe($swipe3.get(0), {
        direction: 'horizontal'
    })
        .on('move', function(t){
            $swipe3.html('swipe3 ' + t.offset.x)
        })

})();