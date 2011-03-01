// Tweemap: a treemap generator v1.0
// Written by Luke Andrews <la@twitter.com>
// Copyright (C) 2011 Twitter, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//
// Uses algorithms described in:
//   "Squarified Treemaps", by Mark Bruls, Kees Huizing, and Jarke J. van Wijk
//   http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.36.6685&rep=rep1&type=pdf

// JSHint commands:
/*global $: true */

var Tweemap = function($outerContainer, parent) {
  this.outerContainer = $outerContainer;
  this.parent = parent;
  this.data = [];
  this.width = 500;
  this.height = 500;
  this.childPadding = 5;
  this.currentBounds = { x: 0, y: 0 };
  this.currentLayoutDirection = 'y';
  return this;
};

Tweemap.prototype.getColorForIndex = function(i) {
  return '#808080';
};

Tweemap.prototype.getHoverColorForIndex = function(i) {
  return '#999';
};

Tweemap.prototype.setColorMethodCallbackNamed = function(methodName, func, shift) {
  if (typeof func === 'function') {
    this[methodName] = function(i) {
      if (shift) {
        i += shift;
      }
      return func(i);
    };
  }
  return this;
};

Tweemap.prototype.setColorCallback = function(func, shift) {
  return this.setColorMethodCallbackNamed('getColorForIndex', func, shift);
};

Tweemap.prototype.setHoverColorCallback = function(func, shift) {
  return this.setColorMethodCallbackNamed('getHoverColorForIndex', func, shift);
};

Tweemap.prototype.setTop = function(v) {
  this.top = v;
  return this;
};

Tweemap.prototype.setWidthAndHeight = function(width, height) {
  this.width = width;
  this.height = height;
  return this;
};

Tweemap.prototype.getArea = function() {
  return this.width * this.height;
};

Tweemap.prototype.setTotal = function(v) {
  this.total = v;
  return this;
};

Tweemap.prototype.setData = function(data) {
  var self = this;
  var totalArea = this.getArea();
  if (!this.total) {
    this.total = 0;
    data.forEach(function(item) { self.total += item.value; });
  }
  if (!this.total) {
    return this;
  }
  this.data = [];
  data.forEach(function(item) {
    self.data.push({
      name: item.name,
      actual: item.value,
      area: item.value/self.total * totalArea,
      children: item.children || []
    });
  });
  return this;
};

Tweemap.prototype.farthestFrom1 = function(a, b) {
  var aDiff = a < 1 ? 1 - a : a - 1;
  var bDiff = b < 1 ? 1 - b : b - 1;
  return aDiff > bDiff ? a : b;
};

Tweemap.prototype.getTotalForStack = function(stack) {
  var total = 0;
  stack.forEach(function(item) {
    total += item.area;
  });
  return total;
};

Tweemap.prototype.layoutAndGetWorstRatio = function(stack) {
  var self = this;
  var nextCoordinate = this.currentBounds[this.currentLayoutDirection];
  var totalAreaForStack = this.getTotalForStack(stack);
  var worstRatio = 1;
  var availableHeight = self.height - nextCoordinate;
  var availableWidth = self.width - nextCoordinate;
  var widthForStack;
  var heightForStack;
  var calculateHeight = function(item, i) {
    var proportionalArea = item.area / totalAreaForStack;
    var stillAvailable = self.height - nextCoordinate;
    item.x = self.currentBounds.x;
    item.y = nextCoordinate;
    item.height = i === stack.length - 1 ? stillAvailable : Math.round(proportionalArea * availableHeight);
    widthForStack = item.width = widthForStack || Math.round(item.area / item.height);
    var ratio = item.height / item.width;
    worstRatio = self.farthestFrom1(ratio, worstRatio);
    nextCoordinate += item.height;
  };
  var calculateWidth = function(item, i) {
    var proportionalArea = item.area / totalAreaForStack;
    var stillAvailable = self.width - nextCoordinate;
    item.x = nextCoordinate;
    item.y = self.currentBounds.y;
    item.width = i === stack.length - 1 ? stillAvailable : Math.round(proportionalArea * availableWidth);
    heightForStack = item.height = heightForStack || Math.round(item.area / item.width);
    var ratio = item.width / item.height;
    worstRatio = self.farthestFrom1(ratio, worstRatio);
    nextCoordinate += item.width;
  };
  stack.forEach(this.currentLayoutDirection === 'x' ? calculateWidth : calculateHeight);
  return worstRatio;
};

Tweemap.prototype.prepareForNextStack = function(stack) {
  var firstItemInStack = stack[0];
  if (this.currentLayoutDirection === 'y') {
    this.currentBounds.x = firstItemInStack.x + firstItemInStack.width;
    this.currentBounds.y = firstItemInStack.y;
  } else {
    this.currentBounds.x = firstItemInStack.x;
    this.currentBounds.y = firstItemInStack.y + firstItemInStack.height;
  }
  // alternate between x and y layout unless the remaining space has more than 4:1 ratio
  var remainingX = this.width - this.currentBounds.x;
  var remainingY = this.height - this.currentBounds.y;
  if (remainingX > remainingY * 4) {
    this.currentLayoutDirection = 'x';
  } else if (remainingY > remainingX * 4) {
    this.currentLayoutDirection = 'y';
  } else {
    this.currentLayoutDirection = this.currentLayoutDirection === 'x' ? 'y' : 'x';
  }
};

Tweemap.prototype.draw = function(stack) {
  var self = this;
  if (this.innerContainer) {
    this.innerContainer.empty();
  } else {
    this.innerContainer = $('<div class="tweemapTreemapContainer"/>');
  }
  this.innerContainer.css({
    width: this.width + 'px',
    height: this.height + 'px'
  });
  if (this.parent) {
    this.innerContainer.css({
      top: (this.top ? this.top + this.childPadding : this.childPadding) + 'px',
      left: this.childPadding + 'px'
    })
  }
  stack.forEach(function(item, i) {
    var labelText = item.name + ' (' + item.actual + ')';
    var color = self.getColorForIndex(i);
    var hoverColor = self.getHoverColorForIndex(i);
    item.label = $('<div class="tweemapTreemapLabel"/>')
      .append(labelText);

    item.element = $('<div class="tweemapTreemapArea"/>')
      .css({
        left: item.x + 'px',
        top: item.y + 'px',
        width: item.width + 'px',
        height: item.height + 'px',
        background: color
      })
      .attr({ title: labelText })
      .append(item.label)
      .appendTo(self.innerContainer)
      .mouseover(function(e) {
        e.stopPropagation();
        item.element.addClass('tweemapTreemapAreaHover').css({ background: hoverColor });
        item.label.css({ background: hoverColor });
      })
      .mouseout(function(e) {
        e.stopPropagation();
        item.element.removeClass('tweemapTreemapAreaHover').css({ background: color });
        item.label.css({ background: '' });
      });
  });
  this.outerContainer.append(this.innerContainer);
};

Tweemap.prototype.render = function() {
  var self = this;
  var allStacks = [];
  var currentStack = [];
  var previousWorst = Math.max(this.width, this.height);
  var currentWorst;
  this.data.forEach(function(item, i) {
    currentStack.push(item);
    currentWorst = self.layoutAndGetWorstRatio(currentStack);
    if (i === 0) {
      currentWorst = self.layoutAndGetWorstRatio(currentStack);
    } else if (i === self.data.length - 1) {
      allStacks = allStacks.concat(currentStack);
    } else if (self.farthestFrom1(currentWorst, previousWorst) === currentWorst) {
      currentStack.pop();
      self.layoutAndGetWorstRatio(currentStack);
      allStacks = allStacks.concat(currentStack);
      self.prepareForNextStack(currentStack);
      currentStack = [item];
      currentWorst = self.layoutAndGetWorstRatio(currentStack);
    }
    previousWorst = currentWorst;
  });
  this.draw(allStacks);
  this.data.forEach(function(item) {
    if (item.children.length > 0) {
      var labelHeight = item.label.outerHeight();
      item.childMap = new Tweemap(item.element, self)
        .setTop(labelHeight)
        .setWidthAndHeight(item.width - self.childPadding*2 - 1, item.height - self.childPadding*2 - labelHeight - 1)
        .setTotal(item.actual)
        .setData(item.children)
        .setColorCallback(self.getColorForIndex, 1)
        .setHoverColorCallback(self.getHoverColorForIndex)
        .render()
    }
  });
  return this;
};
