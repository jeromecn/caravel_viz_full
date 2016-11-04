/* eslint-disable no-underscore-dangle, no-param-reassign */
import d3 from 'd3';


require('./sequences.css');

// Modified from http://bl.ocks.org/kerryrodden/7090426
function sunburstVis(slice) {
  const container = d3.select(slice.selector);

  const render = function () {
    // vars with shared scope within this function
    const margin = { top: 10, right: 5, bottom: 10, left: 5 };
    const containerWidth = slice.width();
    const containerHeight = slice.height();
    const breadcrumbHeight = containerHeight * 0.085;
    const visWidth = containerWidth - margin.left - margin.right;
    const visHeight = containerHeight - margin.top - margin.bottom - breadcrumbHeight;
    const radius = Math.min(visWidth, visHeight) / 2;

    let totalSize;
    const vis;
    const arcs;


    // Dimensions of sunburst.
    const width = visWidth;
    const height = visHeight;

    // Breadcrumb dimensions: width, height, spacing, width of tip/tail.
    const b = {
      w: 75, h: 30, s: 3, t: 10,
    };

    // Mapping of step names to colors.
    const colors = {};

    const sequenceDiv = container.append('div:div').attr('class', 'sequence');
    const chartDiv = sequenceDiv.append('div:div').attr('clas', 'chart');
    const explanationDiv = chartDiv.append('div:div').attr('clas', 'explanation');
    const percentageSPAN = explanationDiv.append('span:span').attr('clas', 'percentage');
    percentageSPAN.text('');


    // Total size of all segments; we set this later, after loading the data.
    totalSize = 0;

    vis = container.append('svg:svg')
        .attr('width', width)
        .attr('height', height)
        .append('svg:g')
        .attr('class', 'container')
        .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

    const partition = d3.layout.partition()
        .size([2 * Math.PI, radius * radius])
        .value(function (d) { return d.size; });

    arcs = d3.svg.arc()
        .startAngle(function (d) { return d.x; })
        .endAngle(function (d) { return d.x + d.dx; })
        .innerRadius(function (d) { return Math.sqrt(d.y); })
        .outerRadius(function (d) { return Math.sqrt(d.y + d.dy); });



    // Main function to draw and set up the visualization, once we have the data.
    function createVisualization(json) {

      // Basic setup of page elements.
      initializeBreadcrumbTrail();
      drawLegend();
      d3.select('.togglelegend').on('click', toggleLegend);

      // Bounding circle underneath the sunburst, to make it easier to detect
      // when the mouse leaves the parent g.
      vis.append('svg:circle')
          .attr('r', radius)
          .style('opacity', 0);

      // For efficiency, filter nodes to keep only those large enough to see.
      const nodes = partition.nodes(json)
          .filter(function (d) {
          return (d.dx > 0.005); // 0.005 radians = 0.29 degrees
          });

      const path = vis.data([json]).selectAll('path')
          .data(nodes)
          .enter().append('svg:path')
          .attr('display', function (d) { return d.depth ? null : 'none'; })
          .attr('d', arc)
          .attr('fill-rule', 'evenodd')
          .style('fill', function (d) { return colors[d.name]; })
          .style('opacity', 1)
          .on('mouseover', mouseover);

      // Add the mouseleave handler to the bounding circle.
      d3.select('.container').on('mouseleave', mouseleave);

      // Get total size of the tree = value of root node from partition.
      totalSize = path.node().__data__.value;
     };

     // Use d3.text and d3.csv.parseRows so that we do not need to have a header
     // row, and can receive the csv as an array of arrays.
     d3.text(slice.csvEndpoint(), function (text) {
       const csv = d3.csv.parseRows(text);
       const json = buildHierarchy(csv);
       createVisualization(json);
     });

    // Fade all but the current sequence, and show it in the breadcrumb trail.
    function mouseover(d) {

      const percentage = (100 * d.value / totalSize).toPrecision(3);
      const percentageString = percentage + '%';
      if (percentage < 0.1) {
        percentageString = '< 0.1%';
      }

      d3.select('.percentage')
          .text(percentageString);

      d3.select('.explanation')
          .style('visibility', '');

      const sequenceArray = getAncestors(d);
      updateBreadcrumbs(sequenceArray, percentageString);

      // Fade all the segments.
      d3.selectAll('path')
          .style('opacity', 0.3);

      // Then highlight only those that are an ancestor of the current segment.
      vis.selectAll('path')
          .filter(function (node) {
                    return (sequenceArray.indexOf(node) >= 0);
                  })
          .style('opacity', 1);
    }

    // Restore everything to full opacity when moving off the visualization.
    function mouseleave(d) {

      // Hide the breadcrumb trail
      d3.select('.trail')
          .style('visibility', 'hidden');

      // Deactivate all segments during transition.
      d3.selectAll('path').on('mouseover', null);

      // Transition each segment to full opacity and then reactivate it.
      d3.selectAll('path')
          .transition()
          .duration(1000)
          .style('opacity', 1)
          .each('end', function () {
                  d3.select(this).on('mouseover', mouseover);
                });

      d3.select('.explanation')
          .style('visibility', 'hidden');
    }

    // Given a node in a partition layout, return an array of all of its ancestor
    // nodes, highest first, but excluding the root.
    function getAncestors(node) {
      const path = [];
      let current = node;
      while (current.parent) {
        path.unshift(current);
        current = current.parent;
      }
      return path;
    }

    function initializeBreadcrumbTrail() {
      // Add the svg area.
      const trail = d3.select('.sequence').append('svg:svg')
          .attr('width', width)
          .attr('height', 50)
          .attr('class', 'trail');
      // Add the label at the end, for the percentage.
      trail.append('svg:text')
        .attr('class', 'endlabel')
        .style('fill', '#000');
    }

    // Generate a string that describes the points of a breadcrumb polygon.
    function breadcrumbPoints(d, i) {
      const points = [];
      points.push('0,0');
      points.push(b.w + ',0');
      points.push(b.w + b.t + ',' + (b.h / 2));
      points.push(b.w + ',' + b.h);
      points.push('0,' + b.h);
      if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
        points.push(b.t + ',' + (b.h / 2));
      }
      return points.join(' ');
    }

    // Update the breadcrumb trail to show the current sequence and percentage.
    function updateBreadcrumbs(nodeArray, percentageString) {

      // Data join; key function combines name and depth (= position in sequence).
      const g = d3.select('.trail')
          .selectAll('g')
          .data(nodeArray, function (d) { return d.name + d.depth; });

      // Add breadcrumb and label for entering nodes.
      const entering = g.enter().append('svg:g');

      entering.append('svg:polygon')
          .attr('points', breadcrumbPoints)
          .style('fill', function (d) { return colors[d.name]; });

      entering.append('svg:text')
          .attr('x', (b.w + b.t) / 2)
          .attr('y', b.h / 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'middle')
          .text(function (d) { return d.name; });

      // Set position for entering and updating nodes.
      g.attr('transform', function (d, i) {
        return 'translate(' + i * (b.w + b.s) + ', 0)';
      });

      // Remove exiting nodes.
      g.exit().remove();

      // Now move and update the percentage at the end.
      d3.select('.trail').select('.endlabel')
          .attr('x', (nodeArray.length + 0.5) * (b.w + b.s))
          .attr('y', b.h / 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'middle')
          .text(percentageString);

      // Make the breadcrumb trail visible, if it's hidden.
      d3.select('.trail')
          .style('visibility', '');

    }

    function drawLegend() {

      // Dimensions of legend item: width, height, spacing, radius of rounded rect.
      const li = {
        w: 75, h: 30, s: 3, r: 3
      };

      const legend = d3.select('.legend').append('svg:svg')
          .attr('width', li.w)
          .attr('height', d3.keys(colors).length * (li.h + li.s));

      const g = legend.selectAll('g')
          .data(d3.entries(colors))
          .enter().append('svg:g')
          .attr('transform', function (d, i) {
                  return 'translate(0,' + i * (li.h + li.s) + ')';
               });

      g.append('svg:rect')
          .attr('rx', li.r)
          .attr('ry', li.r)
          .attr('width', li.w)
          .attr('height', li.h)
          .style('fill', function (d) { return d.value; });

      g.append('svg:text')
          .attr('x', li.w / 2)
          .attr('y', li.h / 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'middle')
          .text(function (d) { return d.key; });
    }

    function toggleLegend() {
      const legend = d3.select('.legend');
      if (legend.style('visibility') == 'hidden') {
        legend.style('visibility', '');
      } else {
        legend.style('visibility', 'hidden');
      }
    }

    // Take a 2-column CSV and transform it into a hierarchical structure suitable
    // for a partition layout. The first column is a sequence of step names, from
    // root to leaf, separated by hyphens. The second column is a count of how
    // often that sequence occurred.
    function buildHierarchy(csv) {
      const root = {'name': 'root', 'children': []};
      for (const i = 0; i < csv.length; i++) {
        let sequence = csv[i][0];
        let size = +csv[i][1];
        if (isNaN(size)) { // e.g. if this is a header row
          continue;
        }
        const parts = sequence.split('-');
        let currentNode = root;
        for (let j = 0; j < parts.length; j++) {
          let children = currentNode['children'];
          let nodeName = parts[j];
          let childNode;
          if (j + 1 < parts.length) {
       // Not yet at the end of the sequence; move down the tree.
     	const foundChild = false;
     	for (let k = 0; k < children.length; k++) {
     	  if (children[k]['name'] == nodeName) {
     	    childNode = children[k];
     	    foundChild = true;
     	    break;
     	  }
     	}
      // If we don't already have a child node for this branch, create it.
     	if (!foundChild) {
     	  childNode = {'name': nodeName, 'children': []};
     	  children.push(childNode);
     	}
     	currentNode = childNode;
          } else {
     	// Reached the end of the sequence; create a leaf node.
     	childNode = {'name': nodeName, 'size': size};
     	children.push(childNode);
          }
        }
      }
      return root;
    };
  };

  return {
    render,
    resize: render,
  };
}

module.exports = sunburstVis;
