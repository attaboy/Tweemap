// Tweemap: a treemap generator v1.0
// Written by Luke Andrews <la@twitter.com>
// Copyright (C) 2011 Twitter, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use this
// file except in compliance with the License. You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//
// Uses algorithms described in:
//   "Squarified Treemaps", by Mark Bruls, Kees Huizing, and Jarke J. van Wijk
//   http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.36.6685&rep=rep1&type=pdf

// JSHint commands:
/*global $: true */

var Tweemap = function($outerContainer, parent) {
  this.outerContainer = $outerContainer;
  this.parent = parent;
  this.parentName = '';
  this.data = [];
  this.areaClasses = [];
  this.width = 500;
  this.height = 500;
  this.childPadding = 5;
  this.shiftColorIndex = parent ? parent.shiftColorIndex + 1 : 0;
  return this;
};

Tweemap.prototype.getColor = function(name, i) {
  return '#808080';
};

Tweemap.prototype.getHoverColor = function(i) {
  return '#999';
};

Tweemap.prototype.setColorCallback = function(func, shift) {
  if (typeof func === 'function') {
    this.getColor = func;
  }
  return this;
};

Tweemap.prototype.setHoverColorCallback = function(func, shift) {
  if (typeof func === 'function') {
    this.getHoverColor = func;
  }
  return this;
};

Tweemap.prototype.getTooltipText = function(properties) {
  return properties.name + ': ' + properties.value;
};

Tweemap.prototype.setTooltipTextCallback = function(func) {
  if (typeof func === 'function') {
    this.getTooltipText = func;
  }
  return this;
};

Tweemap.prototype.getClick = function(name, value) {
  return;
};

Tweemap.prototype.setClickCallback = function(func) {
  if (typeof func === 'function') {
    this.getClick = func;
  }
  return this;
};

Tweemap.prototype.getDisplayName = function(name, parentName) {
  return name;
};

Tweemap.prototype.setDisplayNameCallback = function(func) {
  if (typeof func === 'function') {
    this.getDisplayName = func;
  }
  return this;
};

Tweemap.prototype.setCallbacksFromParent = function(parent) {
  var self = this;
  ['Color', 'HoverColor', 'TooltipText', 'Click', 'DisplayName'].forEach(function(callbackSuffix) {
    self['set'+callbackSuffix+'Callback'](parent['get'+callbackSuffix]);
  });
  return this;
}

Tweemap.prototype.setTop = function(v) {
  this.top = v;
  return this;
};

Tweemap.prototype.setWidthAndHeight = function(width, height) {
  this.width = width;
  this.height = height;
  return this;
};

Tweemap.prototype.setParentName = function(v) {
  this.parentName = v;
  return this;
};

Tweemap.prototype.getArea = function() {
  return this.width * this.height;
};

Tweemap.prototype.setTotal = function(v) {
  this.total = v;
  return this;
};

Tweemap.prototype.getTotalForPercentage = function() {
  return this.parent ? this.parent.getTotalForPercentage() : this.total;
};

Tweemap.prototype.addAreaClass = function(v) {
  this.areaClasses.push(v);
  return this;
};

Tweemap.prototype.getAreaClasses = function() {
  return this.parent ? this.parent.getAreaClasses() : this.areaClasses;
};

Tweemap.prototype.setData = function(data) {
  var self = this;
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
    item.height = i === stack.length - 1 ? stillAvailable : Math.max(Math.round(proportionalArea * availableHeight), 1);
    item.width = widthForStack || Math.min(self.width, Math.round(item.area / item.height));
    widthForStack = item.width;
    var ratio = Math.max(item.height, item.width) / Math.min(item.height, item.width);
    worstRatio = self.farthestFrom1(ratio, worstRatio);
    nextCoordinate += item.height;
  };
  var calculateWidth = function(item, i) {
    var proportionalArea = item.area / totalAreaForStack;
    var stillAvailable = self.width - nextCoordinate;
    item.x = nextCoordinate;
    item.y = self.currentBounds.y;
    item.width = i === stack.length - 1 ? stillAvailable : Math.max(Math.round(proportionalArea * availableWidth), 1);
    heightForStack = item.height = heightForStack || Math.min(self.height, Math.round(item.area / item.width));
    var ratio = Math.max(item.height, item.width) / Math.min(item.height, item.width);
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
    var color = self.getColor(item.name, i + self.shiftColorIndex);
    var hoverColor = self.getHoverColor(i + self.shiftColorIndex);
    var totalForPercentage = self.getTotalForPercentage();
    var areaClassNames = ['tweemapTreemapArea'].concat(self.getAreaClasses());
    var itemAttributes = {
      name: item.name,
      value: item.actual,
      percentage: item.actual / totalForPercentage * 100,
      parent: self.parentName
    };
    if (item.name === 'Other') {
      areaClassNames.push('tweemapTreemapAreaOther');
    }

    item.label = $('<div class="tweemapTreemapLabel"/>')
      .append(self.getDisplayName(item.name, self.parentName));

    item.element = $('<div/>')
      .addClass(areaClassNames.join(' '))
      .css({
        left: item.x + 'px',
        top: item.y + 'px',
        width: item.width + 'px',
        height: item.height + 'px',
        background: color
      })
      .attr({
        title: self.getTooltipText(itemAttributes)
      })
      .append(item.label)
      .appendTo(self.innerContainer);

    itemAttributes.element = item.element;

    var mouseover = function(e) {
      if (!item.element.find('.tweemapTreemapAreaHover').length) {
        item.element.addClass('tweemapTreemapAreaHover').css({ background: hoverColor });
        item.label.css({ background: hoverColor });
      }
    };

    var mouseout = function(e) {
      item.element.removeClass('tweemapTreemapAreaHover').css({ background: color });
      item.label.css({ background: '' });
    };

    var click = function(e) {
      e.stopPropagation();
      self.getClick(itemAttributes);
    };

    item.element
      .mouseover(mouseover)
      .mouseout(mouseout)
      .click(click);
  });
  this.outerContainer.append(this.innerContainer);
};

Tweemap.prototype.render = function() {
  var self = this;
  var allStacks = [];
  var currentStack = [];
  var previousWorst = Math.max(this.width, this.height);
  var currentWorst;
  var totalArea = this.getArea();
  this.currentBounds = { x: 0, y: 0 };
  this.currentLayoutDirection = 'y';

  this.data.forEach(function(item, i) {
    item.area = item.actual/self.total * totalArea,
    currentStack.push(item);
    currentWorst = self.layoutAndGetWorstRatio(currentStack);
    if (i > 0 && self.farthestFrom1(currentWorst, previousWorst) === currentWorst) {
      currentStack.pop();
      self.layoutAndGetWorstRatio(currentStack);
      allStacks = allStacks.concat(currentStack);
      self.prepareForNextStack(currentStack);
      currentStack = [item];
      currentWorst = self.layoutAndGetWorstRatio(currentStack);
    }
    if (i === self.data.length - 1) {
      allStacks = allStacks.concat(currentStack);
    }
    previousWorst = currentWorst;
  });
  this.draw(allStacks);
  this.data.forEach(function(item) {
    if (item.children.length > 0) {
      var labelHeight = item.label.outerHeight();
      var width = item.width - self.childPadding*2 - 1;
      var height = item.height - self.childPadding*2 - labelHeight - 1;
      if (width < 5 || height < 5) {
        return; // don't render children if there's no room
      }
      item.childMap = new Tweemap(item.element, self)
        .setTop(labelHeight)
        .setWidthAndHeight(width, height)
        .setTotal(item.actual)
        .setData(item.children)
        .setParentName(item.name)
        .setCallbacksFromParent(self)
        .render()
    }
  });
  return this;
};
