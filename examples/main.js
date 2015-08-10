(function(){

	new webit.swipe(
		document.querySelector(".w"), 
		{
			dir: "horizontal" 
		}
	)
	.on("start", function(t){
		console.log('started horizontal swipe');		
	})
	.on("end", function(t){
		console.log('end horizontal swipe', t);	
	})
	.on("move", function(t, data){
		console.log('swiping horizontaly');
	});

})();