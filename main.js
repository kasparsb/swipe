jQuery(function(){

	var l = 0;
	$(".w .slide").each(function(){
		$(this).css( "left", l );
		l += $(this).parent().width();
	});

	new webit.swipe( $(".w"), { dir: "horizontal" } )
		.on("start", function(t){
			$(".w .slide").each(function(){
				$(this).data( "left", parseInt($(this).css("left"), 10) )
			});
		})
		.on("end", function(t){
			var w = $(".w").width();
			var d = 600;

			// Alikušais attālums līdz malai
			// ceļs = ātrums * laiks
			var r = w - parseInt($(".w .slide:eq(1)").css("left"), 10);
			var d = r / t.speed;

			$(".w .slide:eq(0)").animate({
				left: -w
			}, d);

			$(".w .slide:eq(1)").animate({
				left: 0
			}, d);


			console.log( t.speed );
		})
		.on("move", function(t, data){

			$(".w .slide").each(function(){
				$(this).css({
					left: $(this).data("left") + t.offset.x
				});
			});
		});

})