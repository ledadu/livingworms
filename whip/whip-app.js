
import { Point, getAngle } from './Point.js';
import { Vector } from './Vector.js';
import { Easing } from './Easing.js';
import { Palette } from './Palette.js';

import { Particle } from './Particle.js';
import { WhipLink } from './WhipLink.js';
import { Whip } from './Whip.js';


const beasts ={
		'simple avec pattes qui tournent': '{"haveSubwhips":true,"subWhipsDef":{"nbsubs":"1","linkCount":"100","attachNum":"0","angleStart":"0","angleMax":"Math.PI * 2","angleRotation":0,"minLinkLength":"0","maxLinkLength":"20","width":"300","friction":0.85,"factorTime":"globals.factorTime","deltaScale":0.85,"lineShapeDef":{"name":"virgule","nbPeriod":"1"},"paletteName":"test","renderLinks":true,"renderBody":true,"renderParticles":false,"haveSubwhips":true,"subWhipsDef":{"nbsubs":"40","linkCount":"40","attachNum":"1*i+13","angleStart":"Math.Pi / 2","angleMax":"0.001","angleRotation":0,"minLinkLength":"0","maxLinkLength":"10","width":"30","friction":"0.95","factorTime":"globals.factorTime","deltaScale":"0.7","lineShapeDef":{"name":"virgule","nbPeriod":"1"},"paletteName":"test","renderLinks":false,"renderBody":true,"renderParticles":false,"haveSubwhips":false,"subWhipsDef":{}}}}',
}


const elements = {
	models : [],
	isNew  : true,
	add	   : function(model) {
		elements.models.push(model);
	},
	empty  : function(){
		elements.models = [];
		elements.isNew   = true;
	}
};


var renderForm = function() {

	console.log('--- renderForm ---');

	var $wormEdit   = $('#wormEdit'),
		$saveButton = $('<div>Save</div>'),
		$loadButton = $('<div>Load</div>');

	$wormEdit.html('');

	$wormEdit.append(renderFieldset('globals', globals, {factorTime:{class:'integer'},reactAngle:{class:'float'}}, globals));


	_.each(whips, function(whip,i){

  		//renderGuiWhip(mainGui, whip);
  		$wormEdit.append(renderFieldset('Whip', whip, whip.getDefinitions(), whip.toJSON()));


	});

	$wormEdit.append('<textArea id="savedContent"></textArea>');
	$saveButton.on('click', function(e){
		$('#savedContent').val(JSON.stringify(whips[0].toJSON()));
	});
	$wormEdit.append($saveButton);

	$wormEdit.append('<textArea id="LoadContent"></textArea>');
	$loadButton.on('click', function(e){
		$.extend(whips[0], JSON.parse($('#LoadContent').val()));
		console.log('load');
		renderForm();
		elements.empty();
	});
	$wormEdit.append($loadButton);


}

var renderFieldset = function(className, objectToBind, definitions, values) {

        var $fieldset  = $('<fieldset data-class="' + className + '"><legend>' + className + ' :</legend></fieldset>');

		//drawn form
		_.each(definitions, function(def,defName){
			var def = def

        	if (defName !== 'subWhipsDef' && defName !== 'lineShapeDef') {
        		$fieldset.append('<label>'+ defName + '</label>' );
        	}

            // boolean
            if (def.class == 'boolean') {
                $fieldset.append('<input type="checkbox" ' + (values[defName]===true ? 'checked="CHECKED"' : '') + ' name="' + defName + '" data-class="' + def.class + '"></input>');

            // paletteName
            } else if(def.class === 'paletteName') {
				var paletteDef = new Palette(),
					$selector = $('<select name="' + defName + '" data-class="' + def.class + '"></select>');
				
				_.each(_.keys(paletteDef.palettes), function(key){
					var $option = $('<option></option>');
					$option.attr('value', key).html(key);
					if (values[defName] === key ) {
						$option.prop('selected','selected');
					}
					$selector.append($option);
				});
            	$fieldset.append($selector);
				
			// texture
            } else if(def.class === 'texture') {
					$selector = $('<select name="' + defName + '" data-class="' + def.class + '"></select>');
				_.each(_.keys(textures), function(key){
					var $option = $('<option></option>');
					$option.attr('value', key).html(key);
					if (values[defName] === key ) {
						$option.prop('selected','selected');
					}
					$selector.append($option);
				});
            	$fieldset.append($selector);

           	// easingName
			} else if(def.class === 'easingName') {
				var easingDef = new Easing();
					$selector = $('<select name="' + defName + '" data-class="' + def.class + '"></select>');
				_.each(_.keys(easingDef.easings), function(key){
					var $option = $('<option></option>');
					$option.attr('value', key).html(key);
					if (values[defName] === key ) {
						$option.prop('selected','selected');
					}
					$selector.append($option);
				});
            	$fieldset.append($selector);

            // Whips
            } else if(def.class === 'Whips') {
                _.each(objectToBind.subWhips, function(subwhip,i){
                    $fieldset.append(renderFieldset('Whip', subwhip.whip, subwhip.whip.getDefinitions(), subwhip.whip.toJSON()));
                });

            // easingOptions
            } else if(def.class === 'easingOptions') {
            	if(!_.isUndefined(objectToBind[defName])){
	            	$fieldset.append(
	        			renderFieldset(
		        			defName,
		        			objectToBind.lineShapeDef,
		        			{
		        				name		: {class:'easingName'},
								nbPeriod    : {class:'float'},
								offset      : {class:'float'}
							},
							{
								name		: values[defName].name,
								nbPeriod    : values[defName].nbPeriod
							}
						)
	        		);
        		}
    		 } else if(def.class === 'subWhipsDef') {
    		 	if (values.haveSubwhips===true){
	            	$fieldset.append(
	        			renderFieldset(
		        			defName,
		        			objectToBind.subWhipsDef,
		        			{
		        				linkCount		: {class:'string'},
		        				nbsubs			: {class:'integer'},
		        				attachNum		: {class:'integer'},
		        				width 			: {class:'float'},
		        				angleRotation   : {class:'float'},
		        				angleStart		: {class:'float'},
		        				angleMax        : {class:'float'},
		        				minLinkLength	: {class:'float'},
		        				maxLinkLength	: {class:'float'},
								paletteName 	: {class:'paletteName'},
								textureName		: {class:'texture'},
								lineShapeDef	: {class:'easingOptions'},
								friction		: {class:'float'},
								deltaScale		: {class:'float'},
								factorTime		: {class:'integer'},
								renderBody		: {class:'boolean'},
		        				renderParticles	: {class:'boolean'},
		        				renderLinks		: {class:'boolean'},
								haveSubwhips    : {class:'boolean'},
								subWhipsDef		: {class:'subWhipsDef'},
							},
							{
								linkCount		: values[defName].linkCount,
								nbsubs			: values[defName].nbsubs,
								attachNum		: values[defName].attachNum,
								paletteName 	: values[defName].paletteName,
								textureName     : values[defName].textureName,
								angleRotation	: values[defName].angleRotation,
								angleStart      : values[defName].angleStart,
								angleMax        : values[defName].angleMax,
								minLinkLength	: values[defName].minLinkLength,
								maxLinkLength	: values[defName].maxLinkLength,
								width 			: values[defName].width,
								friction		: values[defName].friction,
								deltaScale		: values[defName].deltaScale,
								factorTime		: values[defName].factorTime,
								lineShapeDef	: values[defName].lineShapeDef,
								renderBody		: values[defName].renderBody || true,
		        				renderParticles	: values[defName].renderParticles || false,
		        				renderLinks		: values[defName].renderLinks || false,
								haveSubwhips    : values[defName].haveSubwhips,
								subWhipsDef		: values[defName].subWhipsDef,
							}
						)
	        		);
				}
            } else {

        		$fieldset.append('<input name="' + defName + '" data-class="' + def.class + '" value="' + values[defName] + '"></input>');
            }



			$fieldset.append('<br/>');
		});


		//bind input change

		$('>input, >select', $fieldset).on('change', function(e){
			var $target       = $(e.currentTarget),
				fieldsetClass = $target.closest('fieldset').attr('data-class'),
				propName      = $target.attr('name'),
				value         = $target.val();  //get input value

		    // get checkbox value
		    if($target.attr('data-class') == 'boolean'){
		    	value = $target.prop('checked');
		    }

		    //Change Value
			objectToBind[propName] = value;

			//Re-render form
			if($target.attr('name') == 'haveSubwhips'){
		    	setTimeout(renderForm,100);
		    }

			elements.empty();
			
			update();

			app.stage.removeChildren();
			
			elements.models.forEach(function(element) {
				element.stage = app.stage;
				element.loadedResource = loadedResource;
				element.render();
			});
		
		});


		return $fieldset;

}


var appOptions = {
  width  	  : window.innerWidth - 20,
  height 	  : window.innerHeight - 20,
  //forceCanvas : true
}

var app          = new PIXI.Application(appOptions);

var graphicStage = new PIXI.Container();
var graphics = new PIXI.Graphics();

//var faceTexture = PIXI.Texture.fromImage('https://i.imgur.com/MB6ieyP.png'); //Face lol
//var faceTexture = PIXI.Texture.fromImage('https://i.imgur.com/QQ8Oiqw.png'); //Zombi
var faceTexture     = PIXI.Texture.fromImage('https://i.imgur.com/wUXBZOY.png'); //Rainbow

//var tentacleTexture = PIXI.Texture.fromImage('https://i.imgur.com/MB6ieyP.png');
//var tentacleTexture = PIXI.Texture.fromImage('https://s3-us-west-2.amazonaws.com/s.cdpn.io/39255/tentacle.png'); //tentacle
//var tentacleTexture = PIXI.Texture.fromImage('https://i.imgur.com/ADjfftN.png'); //dragon
//var tentacleTexture     = PIXI.Texture.fromImage('https://i.imgur.com/wUXBZOY.png'); //Rainbow
//var tentacleTexture     = PIXI.Texture.fromImage('https://i.imgur.com/HZ39SVh.jpg'); //planes
//tentacleTexture.rotate=2;
var loadedResource = [];

//const image = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/39255/tentacle.png'; //tentacle

const textures = {
	dragon:	'https://i.imgur.com/ADjfftN.png',
//const image = 'https://i.imgur.com/QQ8Oiqw.png'; //zombie
	rainbow: 'https://i.imgur.com/wUXBZOY.png',  //rainbow
//const image = 'https://i.imgur.com/HZ39SVh.jpg';  //Planes
	flower: 'https://i.imgur.com/2KtIO.gif?noredirect',
	millipede: 'images/millipede.png',
//const image = 'https://i.imgur.com/iNJvEBh.jpg';  //bob

};

const loader = PIXI.loader;
// Load textures
_.each(textures, (path, id) => loader.add(id, path));

var canvas = null;
var ctx = null;
var w = 0;
var h = 0;

var mainGui = {};


// Listen for window resize events
window.addEventListener('resize', resize);

// Resize function window
function resize() {
	// Resize the renderer
	app.renderer.resize(window.innerWidth, window.innerHeight);
}

loader.load((loader, resources) => {
	// Store Resources
    
	_.each(resources, (resource,id) => { loadedResource[id] = resource; }); 
	
	//Add render space
	document.body.appendChild(app.view);
	
	//Add graphics layer
	app.stage.addChild(graphics);

	//stats FPS
	javascript:(function(){var script=document.createElement('script');script.onload=function(){var stats=new Stats();document.body.appendChild(stats.dom);requestAnimationFrame(function loop(){stats.update();requestAnimationFrame(loop)});};script.src='http://rawgit.com/mrdoob/stats.js/master/build/stats.min.js';document.head.appendChild(script);})()

//mobile console

/*
mobileConsole.options({
	showOnError: true,
	proxyConsole: false,
	isCollapsed: true,
	catchErrors: true
});
*/

//mobileConsole.show();


	/*
	document.body.appendChild(renderer.view);
	graphicStage.addChild(graphics);
	/*
	canvas = $('canvas').get(0);
	w = canvas.width = window.innerWidth - 20;
	h = canvas.height = window.innerHeight - 20;
	ctx = canvas.getContext('2d');

	 canvas.addEventListener( 'mousedown', onMouseDown, false );
	 canvas.addEventListener( 'mousemove', onMouseMove, false );

	 canvas.addEventListener( 'touchstart', onTouchStart, false );
	 canvas.addEventListener( 'touchmove', onTouchMove, false );
	  var rect = canvas.getBoundingClientRect();
	  canvasOffsetLeft = rect.left;
	  canvasOffsetTop = rect.top;

    img.onload=function(){
        //ctx.drawImage(img,0,0,img.width,img.height,0,0,w,h);
		ctx.fillStyle = "rgba(0,0,0,1)";
		ctx.fillRect(0,0,w,h);
    }
	*/
    //img.src="http://static9.depositphotos.com/1001311/1123/i/950/depositphotos_11236001-The-brown-wood-texture-with-natural-patterns.jpg";

	//mainGui = new dat.GUI();

	renderForm();

	console.log(whips);

	var mouseposition = {x: canvasOffsetLeft / 2, y: canvasOffsetTop / 2};//app.renderer.plugins.interaction.mouse.global;
	console.log('yaaaaaa');
	app.stage.interactive = true;
    app.stage.on('pointerdown', function(e){
		console.log('lalala');
	});

	app.stage.on('pointermove', function(e){
		mouseposition = e.data.global;
	});

	app.ticker.add(function() {
		if (app.renderer.plugins.interaction.mouse.buttons === 1) {
			whips.forEach(function(whip, index) {
				  whip.target = {
					x : mouseposition.x - canvasOffsetLeft,
					y : mouseposition.y - canvasOffsetTop
				  };
				//console.log(whip.sprites);


			});
		}
		
		elements.models.forEach(function(sprite) {
			
			if (sprite.updateGraphic) { sprite.updateGraphic();}
			// Adapt cuted sprites to trapezoid
			//console.log(sprite.cuttedSprite);
			//console.log('sections', sprite.sections);
			_.each(sprite.cuttedSprites, (cuttedSprite, i) => {
				
				if (_.isUndefined(sprite.sections[i])) {return;}
				cuttedSprite.proj.mapBilinearSprite(cuttedSprite, sprite.sections[i]);
			});
		});
		
		update();

	});

});

var globals = {
	factorTime : 100,
	reactAngle: 0.05,
};


var whips   = [];
var cuttedSprites = [];
var sections = [];

// 1rst bestiole

/*
whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 60,
		maxLinkLength: 7,
		width: 40,
		friction: 0.7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShapeDef:{name:'sansue', nbPeriod:1},
		paletteName: 'test'
	})
);
*/
/*
var nbsubs = 24;
whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 600,
		maxLinkLength: 2,
		width: 20,
		friction: 0.7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShapeDef: {name:'combo', nbPeriod:'1+Math.sin(time/20)/2'},
		renderParticles:true,
		subWhipsDef	: {
			linkCount     : 'Math.round((nbsubs - i)/nbsubs * 50)',
			attachNum     : 'Math.round(Math.floor(i/2) * 50 * (0.5+Math.sin(-time/20) /4))',
			angleStart	  : 'Math.sin(time/20) * Math.PI/4 *  ( (i % 2)==0 ? 1 : -1 )',
			angleMax	  : 0.2,
			angleRotation : 0,
			nbsubs        :  nbsubs,
			maxLinkLength	: 10,
			width 			: 5,
			friction		: friction + 0.085,
			deltaScale		: deltaScale.normal,
			lineShapeDef	: {name:'virgule', nbPeriod:'1'},
			paletteName 	: 'test',
			renderLinks     : true
		},
		subWhips: new function(){
			var _subWhips = [];
			for ( var i=2; i < nbsubs; i++ ) {

				var subWhip = {
					attachNum : Math.floor(i/2) * 50,
					whip: new Whip({
						x: 1100,
						y: 1150,
						linkCount: Math.round((nbsubs - i)/nbsubs * 200),
						maxLinkLength:3,
						width: 2,
						friction: friction + 0.085,
						deltaScale: deltaScale.normal,
						lineShapeDef: {name:'worm', nbPeriod:nbsubs/(i*2)},
						paletteName: 'mega',
						angleRotation: Math.PI /60 * ( (i % 2)==0 ? 1 : -1 ),
					})
				};
				_subWhips.push(subWhip);
			}
			return _subWhips;

		}
	})
);
*/
/*
whips.push(
	new Whip({
	  x: 100,
	  y: 100,
	  linkCount: 300,
	  maxLinkLength: 3,
	  width: 10,
	  friction: 0.7,
	  deltaScale: deltaScale.speed,
	  lineShapeDef: {name:'combo', nbPeriod:4, injectedEasingDef:{nbPeriod:8}}
	})
);
*/

// 2eme bestiole
/*
whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 50,
		maxLinkLength: 15,
		width: 30,
		friction: 0.7,
		angleMax: Math.PI/7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShapeDef:{name:'sansue', nbPeriod:1},
		paletteName: 'test',
		// renderParticles:true,
		//renderLinks:true,
		subWhips: new function(){
			var _subWhips = [];
			for ( var i=2; i < 48; i++ ) {
				var subWhip = {
					attachNum :  Math.floor(i/2) * 2,
					whip: new Whip({
						x: 1100,
						y: 1150,
						linkCount: 1,
						maxLinkLength: new Easing({name:'sansue', nbPeriod:1}).getEasing(30, Math.floor(i/2) * 12 /300),
						minLinkLength: new Easing({name:'sansue', nbPeriod:1}).getEasing(30, Math.floor(i/2) * 12 /300),
						width: 1,
						friction: friction + 0.085,
						deltaScale: deltaScale.normal,
						lineShapeDef: {name:'virgule', nbPeriod:1},
						paletteName: 'orangeDark',
						angleStart: Math.PI/2 * ( (i % 2)==0 ? 1 : -1 ),
						subWhips: [{
								attachNum : 1,
								whip: new Whip({
									x: 1100,
									y: 1150,
									linkCount:50,
									maxLinkLength:2,
									width: 2,
									friction: friction + 0.075,
									deltaScale: deltaScale.normal,
									lineShapeDef: {name:'virgule', nbPeriod:1},
									// palette: Palettes.orangeDark
								})
							}]
					})
				};
				_subWhips.push(subWhip);
			}
			return _subWhips;
		},

	})
);
*/




// 3eme bestiole
/*
var nbsubs = 50;
whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 100,
		maxLinkLength: 10,
		width: 15,
		friction: 0.7,
		//angleMax: Math.PI/7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShapeDef: {name:'worm',nbPeriod:1},
		paletteName: 'orangeDark',
		// renderParticles:true,
		//renderLinks:true,
		subWhipsDef	: {
			nbsubs        :  nbsubs,
			linkCount     : '1',
			attachNum     : 'Math.floor(i/2) * 4',
			angleStart	  : 'Math.PI/2 * ( (i % 2)==0 ? 1 : -1 )',
			angleMax	  : 0.2,
			angleRotation : 0,
			maxLinkLength	: 'new Easing({name:\'worm\', nbPeriod:1}).getEasing(15, Math.floor(i/2) * 8 /26)',
			minLinkLength	: 'new Easing({name:\'worm\', nbPeriod:1}).getEasing(15, Math.floor(i/2) * 8 /26)',
			width 			: 1,
			friction		: friction + 0.085,
			deltaScale		: deltaScale.normal,
			lineShapeDef	: {name:'virgule', nbPeriod:'1'},
			paletteName 	: 'test',
			renderLinks:false,
            renderBody:false,
            renderParticles:false,
			subWhipsDef	: {
				nbsubs  :  1,
				attachNum : 0,
              	renderLinks:false,
	            renderBody:true,
	            renderParticles:false,
				linkCount:10,
		        angleMax: 'Math.PI/90',
				maxLinkLength:4,
				minLinkLength:4,
				width: 3,
				friction:  1,
				deltaScale: deltaScale.speed,
				lineShapeDef: {name:'worm', nbPeriod:1.8},
				paletteName: 'orangeDark'
			}
		}
	})
);
*/
/*
var nbsubs = 40;
whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 100,
		maxLinkLength: 2,
		width: 40,
		friction: 0.7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShapeDef: {name:'sansue', nbPeriod:1},
		paletteName: 'test',
		renderParticles:true,
		subWhips: new function(){
			var _subWhips = [];
			for ( var i=2; i < nbsubs; i++ ) {
				var subWhip = {
					attachNum : Math.floor(i/2) * 3,
					whip: new Whip({
						x: 1100,
						y: 1150,
						linkCount: Math.round(new Easing({name:'sansue', nbPeriod:1}).getEasing(1,i/nbsubs) * 20),
						maxLinkLength:2,
						width: 1,
						friction: friction + 0.085,
						deltaScale: deltaScale.normal,
						lineShapeDef: {name:'virgule', nbPeriod:1},
						angleRotation: Math.PI /60 * ( (i % 2)==0 ? 1 : -1 ),
						paletteName: 'orangeDark',
					})
				};
				_subWhips.push(subWhip);
			}
			return _subWhips;
		},
	})
);
*/

// 4 eme bestiole
/*
var nbsubs = 24;
whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 600,
		maxLinkLength: 2,
		width: 20,
		friction: 0.7,
		deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		lineShapeDef: {name:'combo', nbPeriod:'1+Math.sin(time/20)/2'},
		renderParticles:true,
	})
);

*/

/*
whips.push(
	new Whip({"haveSubwhips":true,"subWhipsDef":{"nbsubs":"1","linkCount":"4","attachNum":"0","angleStart":"0","angleMax":"Math.PI * 2","angleRotation":0,"minLinkLength":"0","maxLinkLength":"100","width":"100","friction":0.85,"factorTime":"globals.factorTime","deltaScale":0.85,"lineShapeDef":{"name":"bloby","nbPeriod":"1"},"paletteName":"test","renderLinks":true,"renderBody":true,"renderParticles":false,"haveSubwhips":false,"subWhipsDef":{}}}
));
*/
//bestiole preset
var nbsubs = 0;

whips.push(
	new Whip({
		x: 100,
		y: 100,
		linkCount: 1,
		maxLinkLength: 0,
		width: 0,
		friction: 0,
		//angleMax: Math.PI/7,
		//deltaScale: deltaScale.speed,
		// lineShape: new Easing({nbPeriod:4, injectedEasing:new Easing({nbPeriod:16}).linear}).combo,
		//lineShapeDef: {name:'worm',nbPeriod:1},
		//paletteName: 'orangeDark',
		// renderParticles:true,
		//renderLinks:true,
		/*haveSubwhips:true,
		subWhipsDef:{
			linkCount: 100,
			width: 200,
			maxLinkLength: 20,
			friction: 0,
			angleMax: 'Math.PI/7',
		},*/
        renderBody:false,
	})
);

function update() {
	whips.forEach(function(whip) {
		whip.update(elements);
	});
	if(elements.isNew){
		elements.models.reverse();
		elements.models = _.sortBy(elements.models, function(model){return -model.layerIndex;});

		elements.isNew = false;
	}

}



// --------------------------  -------------------------- //

var canvasOffsetLeft = 0, canvasOffsetTop = 0;


function onMouseDown( event ) {
  event.preventDefault();
  moveHinge( event );
 /* canvas.addEventListener( 'mousemove', moveHnige, false );
  canvas.addEventListener( 'mouseup', onMouseup, false );*/
}

function onMouseMove( event ) {
  event.preventDefault();
  if (event.buttons===1) {
  	moveHinge( event );
  }
}

function onTouchStart( event ) {
  event.preventDefault();
  moveHinge( event.changedTouches[0] );
}

function onTouchMove( event ) {
  event.preventDefault();
  moveHinge( event.changedTouches[0] );
}

/*
function onMouseup() {
  canvas.removeEventListener( 'mousemove', moveHinge, false );
  canvas.removeEventListener( 'mouseup', onMouseup, false );
}*/

function moveHinge( event ) {
  whips.forEach(function(whip, index) {
	  whip.target = {
		x : event.pageX - canvasOffsetLeft,
		y : event.pageY - canvasOffsetTop
	  };
  });

}



