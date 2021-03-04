/**
 * Construct a new Circle Pack for use within a Planet
 * @param {Number} radius - The radius of the Visualization
 */
mood.planetPack = function(radius = 1000) {

    // Protect against missing new keyword
    if (!(this instanceof mood.planetPack)) {
        return new mood.planetPack();
    }

    // We need to work out some offsets for translating to the center of nodes
    // Note that these don't properly chain all the way to the root so that
    // we can only currently zoom down 3 levels.
    let maxDepth = 4;
    let speed = 250;

    let self = this;                                            // Keep a reference to this
    let container = null;                                       // The container of the nested Pack
    let margin = { top: 0, bottom: 0, left: 0, right: 0};       // The margin for the visualization
    let viz = null;                                             // The visualization layer
    let d = null;                                               // The data object
    let root = null;
    let view = null;
    let focusNode = null;
    let packs = [];  
    let scroller = null;
    let id =0;

    /**
     * Sets the data for this Circle Pack
     * @param {object} _ - The root of the Circle Pack
     * @returns {object} The root of the Circle Pack
     */
    this.data = function(_) {        
        if (!arguments.length) return d;
        d = _;        
        if(root) {
            flattenTree(d).forEach(n => {n.pack = root;});            
            root.data(d); 
            self.render();
        }

        focusNode = d;
        return self;
    };

    /**
     * Sets the data for this Circle Pack
     * @param {object} _ - The root of the Circle Pack
     * @returns {object} The root of the Circle Pack
     */
    this.color = function(_) {
        if(!arguments.length) return color;

        if(root) {
            console.warn("Unable to modify `color` after being appendTo()");
            return self;
        }

        color = _;
        return self;
    };

    /**
     * Sets the radius for this Circle Pack
     * @param {object} _ - The radius of the Circle Pack
     * @returns {object} The radius of the Circle Pack
     */
    this.radius = function(_) {
        if(!arguments.length) return radius;

        if(root) {
            console.warn("Unable to modify `radius` after being appendTo()");
            return self;
        }

        radius = _;
        return self;
    };

    /**
     * Sets the margin for the Circle Pack
     * @param {{ top: Number, right: Number, bottom: Number, left: Number }} _ - An object describing the margin properties
     * @returns {nestCirclePack} The Circle Pack or the margin
     */
    this.margin = function(_) {
        if(!arguments.length) return margin;

        if(root) {
            console.warn("Unable to modify `margin` after being appendTo()");
            return self;
        }

        margin = _;
        return self;
    }

    /**
     * Render the visualization
     * @returns {object} The Circle Pack
     */
    this.render = function() {
        
        //scroller.render();

        // Don't render if there is no root
        if(!root) return;

        // Determine which pack layouts are being used
        let usedPacks = _.uniq(findAncestorNodes().map(n => n.pack));

        // Go through all the packs in reverse order
        for(var i = packs.length - 1; i >= 0; i--) {
            let pack = packs[i];
            if(usedPacks.indexOf(pack) === -1) {
                pack.dispose();
                packs.splice(i, 1);
                continue;
            }

            // Render the remaining packs
            pack.render();
        }

        return self;
    };

    // Keep a reference to render so internal functions can access it
    let render = this.render;

    /**
      * Returns a version of a particular color that contrasts the given one
      * @param {String} color - The hex color
      * @returns {String} - A color that is either a lighter or darker variant of the given one depending on the best contrast
      */
    function contrast(color) {
        let rgb = d3.rgb(color);
        return (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) < 125 ? rgb.brighter(): rgb.darker();
    };

    /**
     * Returns either black or white, depending on which will contrast the given color appropriately
     * @param {String} color - The hex color
     * @returns {String} - Either black or white as a Hex color
     */
    let blackOrWhite = function(color) {
        let rgb = d3.rgb(color);
        return (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) < 125 ? "#FFF": "#000";
    };

    /**
     * Function that takes a Tree object and flattens it to return a set of Nodes
     * @param {Object} tree - The tree object, each node in the tree should have any children stored in a `children` property.
     * @returns {Array} An array of all the nodes
     */
    function flattenTree(tree) {
        let nodes = [tree];

        // If there are children then iterate over them
        if(tree.children) {
            tree.children.forEach(c => nodes = nodes.concat(flattenTree(c)));
        }

        return nodes;
    };

    /**
     * Returns a list of all the parent nodes from the selected node
     * @returns {Array} The set of parent nodes
     */
    function findAncestorNodes() {

        let node = focusNode;
        let parents = [node];

        // If we have no parent, but we have a link then add the link in
        if(node.link) {
            parents.push(node.link);
        }

        // Walk up the tree following the bi-directional linked datasets (link property)
        while(node.parent != null || node.link != null) {
            let parent = node.parent || node.link;
            parents.push(parent);
            node = parent;
        }

        return parents;
    };

    /**
     * Zoom to a particular location
     * @param {[ cx, cy, width ]} v - An array containing the center values and the size of the view port
     */
    function zoomTo(v, d) {

        // Calculate a scaling factor
        let k = radius / v[2];
        view = v;

        // Obtain the X,Y co-ordinates
        let x = v[0] + (d.offsetX || 0);
        let y = v[1] + (d.offsetY || 0);

        // Subtract the radius of the visualization (this should be the radius of the circle to focusNode on)
        x -= v[2];
        y -= v[2];

        // Multiply the offset by the scaling factor
        x *= -k;
        y *= -k;

        // Transition the view to zoom in on the circle
        viz.transition()
           .duration(1000)
           .attr("transform", "translate(" + [x, y] + ")scale(" + k + ")");
    };

    /**
     * Constructor for a Nest Circle Pack
     */
    let nestedPack = function(radius, depth, margin) {

        let self = this;                                                // Keep a reference to this
        let container = null;                                           // The container of the nested Pack
        let viz = null;                                                 // The visualization layer
        let data = null;                                                // The data object
        let pack = d3.layout.pack()                                     // The D3 Pack Layout
                     .padding(5 / depth)
                     .sort((a, b) =>(a.ordinal || 0) - (b.ordinal || 0))
                     .size([radius * 2, radius * 2])
                     .value(function(d) { return 1; });

        this.depth = depth;
        margin = margin || { top: 0, bottom: 0, left: 0, right: 0};     // The margin for the visualization

        /**
         * Appends the visualization to the given target
         * @param {String/d3.selection} target - Either a D3 selection, or a suitable string selector for the target
         */
        this.appendTo = function(target) {            
            // Grab the container to add the visualization into
            container = d3.select(target);

            // Add a new container for the visualization
            viz = container.append("g").attr("transform", "translate(" + [margin.left, margin.top] + ")");           

            return self;
        };

        /**
          * Sets the data for this Circle Pack
          * @param {object} _ - The root of the Circle Pack
          * @returns {object} The root of the Circle Pack
          */
        this.data = function(_) {
            if (!arguments.length) return data;
            data = _;
            if (data.children instanceof Array) { data.children.forEach((item, index) =>item.ordinal = isNaN(item.ordinal) ? index : item.ordinal); }
            //focusNode = d;
            self.render();
            return self;
        };

        /**
         * Exits elements that should no longer exist
         * @param {d3.selection} join - The D3 joined data selection
         */
        function exit(join) {

            // Remove the text elements
            join.exit().select("text").remove();

            // Transition out the circles, and then remove the groups once finished
            join.exit()
                .select("circle")
                .transition()
                .duration(speed)
                .attr("r", 0)
                .each("end", function() { join.exit().remove(); });
        };

        /** Determine if the text labels should be visible */
        let showText = function(node) {           
            if(node.parent) {
                if(node.parent === focusNode) return true;
                if(node.parent.link === focusNode) return true;
            }

            return false;
        };

        /**
         * Updates the elements that still exist
         * @param {d3.selection} join - The D3 joined data selection
         */
        function update(join) {

            // Fill the circles if they are within the selection hierarchy
            let parents = findAncestorNodes();             

            //join.transition().attr("transform", function(d) {return "translate(" + [d.x,d.y] + ")"});
            
            join.select("circle")
                .style("fill", function(d) { return parents.indexOf(d) !== -1 ? color : "#FFF"; });          

            join.classed("createNewNode", function(d) { return d.type && d.type.indexOf('createNewNode') > -1; });

            // Move the circles to new locations and re-size as required  

            join.transition("positionAndRadius")
                .duration(500)
                .attr("transform", function(d) { return "translate(" + [d.x,d.y] + ")"; })                                        
                .select("circle")
                .attr("r", function(d) { return d.r; });                
            
            join.select("text").text(function(d){return d.name;});
            
            
            // If the nodes need to be visible but aren't then toggle them now
            join.select("text").style("display", function(d) { return showText(d) ? "inline" : this.style.display; });

            // Hide the text if necessary
            join.transition("text")
                .duration(500)
                .select("text")
                .style("fill-opacity", function(d) { return showText(d) ? 1 : 0; })
                .each("end", function(d) { if (!showText(d)) this.style.display = "none"; });
        };

        /**
         * Enter the new elements
         * @param {d3.selection} join - The D3 joined data selection
         */
        function enter(join) {
            let parents = findAncestorNodes();

            let groups = join.enter()
                             .append("g")
                             .filter(function(d) {
                                 if(self === root) return true;   // Include all nodes from the root pack
                                 return d !== data;               // Exclude root nodes from all subsequent packs
                             })
                             .attr("transform", function(d) { return "translate(" + [d.x,d.y] + ")"; })
                             .attr("class", "node depth-" + depth)
                             .classed("node-root", function(d) { return d === data; })
                             .classed("node-leaf", function(d) { return d.children == null; })
                             .classed("createNewNode", function(d) { return d.type && d.type.indexOf('createNewNode') > -1; })
                             .on("click", click);

            // Create the Circles
            let circles = groups.append("circle")
                                .attr("r", 0)
                                .style("stroke", contrast(color))
                                .style("fill", function(d) { return parents.indexOf(d) !== -1 ? color : "#FFF"; })
                                .transition().delay(speed).duration(speed)
                                .attr("r", function(d) { return d.r; });

            // Create the labels
            let text = groups.append("text")
                             .attr("class", "label")
                             .style("fill-opacity", function(d) { return showText(d) ? 1 : 0; })
                            .style("display", "inline")//function(d) { return d.parent === data ? "inline" : "none"; })
                            .text(function(d) { return d.name; })
                            .transition()
                            .delay(speed)
                            .duration(speed)
            //.style("fill-opacity", 1) //function(d) { return d.parent === data ? 1 : 0; }
            ;
        }

        /**
         * Render the visualization
         */
        this.render = function() {

            var that = this;

            // Don't render if we've not yet been added
            if(container == null || data == null) return; 
            
            var allChildren = data.children.slice(0);

            if(data.type && data.type.indexOf('zoomable') > -1){
                

                if(!scroller){
                    var dynamicNodes = data.children.filter(function(d) {return d.type == null || d.type.indexOf('static') === -1});
                
                    var pages = Math.ceil(dynamicNodes.length/17);

                    scroller = new mood.d3.circularScroller()
                    .configure({
                        min: 0,
                        max: pages - 1,
                        value: 0,
                        width: 20,
                        gapSize: 1,
                        radius: 440,
                        margin: { top: 440, left: 440, },
                        target: '#target',
                        callback: function (scroller, value) {
                            scroller.value(value);
                            render();
                        },
                    })
                .render();
                }

                var staticChildren = data.children.filter(function(d) {return d.type && d.type.indexOf('static') > -1});
                var dynamicChildren = data.children.filter(function(d) {return d.type == null || d.type.indexOf('static') === -1}).slice((scroller.value() > 0 ? scroller.value() * (19 - staticChildren.length) : 0),(scroller.value() > 0 ? scroller.value() * (19 - staticChildren.length) : 0) + (19 - staticChildren.length));
                      
                data.children = dynamicChildren.concat(staticChildren);  

            }            
            
            // Run the layout on the set of nodes
            let nodes = pack.nodes(data);  
            
            //revert children so full array of children is available on subsequent renders
            data.children = allChildren;     
            
            // Join the data to the set of nodes
            
            let join = viz.selectAll(".depth-" + depth)
                          .data(nodes, (n) => n.name + "__" + depth);
            
            // Run enter/exit/update operations
            exit(join);
            update(join);
            enter(join);

            // Zoom to the initial root
            return self;
        };

        /**
         * Cleans up a Pack layout - removing it from the DOM
         */
        this.dispose = function() {

            // If this visualization is linked to another dataset
            // then break the link in both directions
            if(data.link) {
                let target = data.link;
                target.link = null;
                data.link = null;
            }

            viz.selectAll("text").remove();
            viz.selectAll("circle")
               .transition()
               .duration(speed)
               .attr("r", 0)
               .each("end", function() { viz.remove(); });
        };

        /**
        * Zooms to the particular node that was clicked using a transition
        * @param {Object} d - The data for the node that was clicked
        */
        function zoom(d) {

            focusNode = d;

            // Create a transition for the zoom
            let transition = d3.transition()
                               .tween("zoom", function(d) {
                                   let i = d3.interpolateZoom(view, [focusNode.x, focusNode.y, focusNode.r]);
                                   return function(t) { zoomTo(i(t), focusNode); };
                               });
        };

        /**
         * Handle the click event of a Planet
         * @param {Object} d - The datum for the element that was clicked
         */
        function click(d) {

            // This is the circle that was clicked
            let element = this;

            if(d.type && d.type.indexOf('createNewNode') > -1){                 
                d3.select('#newNodeName').style('display', 'inline-block');
                return;
            }            
            
            if(scroller){
                scroller.dispose();
                scroller = null;
            }
            
                // We don't need to zoom if the same node was clicked
                if(focusNode !== d) {

                    // Transition + Zoom to the circle first
                    zoom(d);
                
                    // If we have a URL to zoom into
                    if(d.url && !d.link) {
                        d3.json(d.url, function(error, data) {

                            // Create a new pack ready for rendering
                            let pack = new nestedPack(d.r, depth + 1, { top: -d.r, left: -d.r });

                            let parent = self.data();
                            let offsetX = (parent.offsetX || 0)+ (d.x - d.r);
                            let offsetY = (parent.offsetY || 0)+ (d.y - d.r);

                            // Set the offsets on all the child nodes
                            let nodes = flattenTree(data);
                            flattenTree(data).forEach((n) => {
                                n.offsetX = offsetX;
                                n.offsetY = offsetY;
                                n.pack = pack;
                            });

                            // The nested packs aren't really linked in the data (doing so creates)
                            // bubbles of different sizes. So instead we create an artificial
                            // link to join the two together
                            data.link = d;
                            d.link = data;

                            // Create the new pack layout
                            pack.data(data)
                                .appendTo(element)
                                .render();

                            // Keep track of this pack and the hierarchy of packs
                            packs.push(pack);
                            pack.parent = self;

                            // Zoom to the selected node and re-render
                            zoomTo([data.x, data.y, radius], data);
                            render();
                        })
                    } else {
                        render();
                    }

                    d3.event.stopPropagation();
                }            
        };
    };

    /**
     * Appends the visualization to the given target
     * @param {String/d3.selection} target - Either a D3 selection, or a suitable string selector for the target
     */
    this.appendTo = function(target) {
        var that = this;
        d3.select('body').append('div').attr('id','newNodeName').append('span').text('Name:').append('input').attr('type','text').on("keydown", function(d) { 
            if(d3.event.keyCode === 13){
                d3.select('#newNodeName').style('display', 'none');  
                
                var newNodeInput = d3.select('#newNodeName input')[0][0];  
                
                var root = that.data();                
               
                root.children[root.children.length - 1].name = newNodeInput.value;
                root.children[root.children.length - 1].type = null;
                
                root.children.push({depth:1, name:'+', type:'static,createNewNode', pack:root.children[root.children.length - 1].pack, parent:root.children[root.children.length - 1].parent});  
                
                newNodeInput.value= '';

                //var dynamicNodes = that.data().children.filter(function(d) {return d.type == null || d.type.indexOf('static') === -1});
                
                //scroller.max(Math.ceil(dynamicNodes.length/17) - 1);                
                
                that.render();               
            }                
        });

        d3.select('#newNodeName').append('i').attr("class", "material-icons").text("close").on("click", function(d) {
            d3.select('#newNodeName').style('display', 'none');
        });
        
        // Grab the container to add the visualization into
        container = d3.select(target);

        // Add a new container for the visualization
        viz = container.append("g")
                       .attr("class", "zoom-layer")
                       .attr("transform", "translate(" + [margin.left, margin.top] + ")");        

        //var dynamicNodes = that.data().children.filter(function(d) {return d.type == null || d.type.indexOf('static') === -1});
                
        //var pages = Math.ceil(dynamicNodes.length/17);
        
        //scroller = new mood.d3.circularScroller()
        //    .configure({
        //        min: 0,
        //        max: pages - 1,
        //        value: 0,
        //        width: 20,
        //        gapSize: 1,
        //        radius: 440,
        //        margin: { top: 440, left: 440, },
        //        target: '#target',
        //        callback: function (scroller, value) {
        //            scroller.value(value);
        //            render();
        //        },
        //    })
		//	.render();

        // Create the root circle pack
        root = new nestedPack(radius, 1).data(d).appendTo(".zoom-layer");
        
        flattenTree(d).forEach(n => {n.pack = root;});   
        
        // Need to render separately to ensure that `root` has been defined first
        // as this is used in the display logic
        root.render();

        // Push into the set of Packs
        packs.push(root);

        zoomTo([d.x, d.y, radius], d);
        console.warn("Replace .zoom-layer with viz");

        return self;
    };
};