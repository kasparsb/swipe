(function(){

	var swipe;
	var el = $(".swipe").get(0);
	var $log = $(".log");

	function settings() {
		var direction = $('[name=dir]').val();
		var minWidth = $('[name=min-width]').val();
		var minHeight = $('[name=min-height]').val();
		var minDuration = $('[name=min-duration]').val();
		
		var s = {};

		if (direction) {
			s.direction = direction;
		}

		if (minWidth) {
			s.minWidth = minWidth;
		}

		if (minHeight) {
			s.minHeight = minHeight;
		}

		if (minDuration) {
			s.minDuration = minDuration;
		}

		return s;
	}

	function configureSwipe() {
		if (!swipe) {
			swipe = new webit.swipe(el, settings())
				.on("start", function(t){
					clearLog();
					logEvent('start', t);
				})
				.on("end", function(t){
					logEvent('end', t);
				})
				.on("move", function(t){
					logEvent('move', t);
				});
		}
		// If swipe initialized, then reconfigure it
		else {
			swipe.config(settings());
		}
	}

	function clearLog() {
		$log.find('div').html('');
	}

	function logEvent(t, ev) {
		if (t == 'end') {
			$log.find('.move').html('');
		}
		$log.find('.'+t).html(t+objHTML(ev));
	}

	function objHTML(obj) {
		var h = '<div class="obj"><div>{</div>';
		
		for (var p in obj) {
			if (typeof obj[p] == 'object') {
				h += '<div class="p">'+p+': '+objHTML(obj[p])+'</div>';	
			}
			else {
				h += '<div class="p">'+p+': '+obj[p]+'</div>';		
			}
		}
		
		h += '<div>}</div></div>';

		return h;
	}

	$('form').on('submit', function(ev){
		ev.preventDefault();

		configureSwipe();
	});

	configureSwipe();

})();