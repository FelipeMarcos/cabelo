import { assign, maxValue } from './utils';
import is from './utils/is';
import {
  getFunctionValue,
  updateTransform,
  normalizeEasing
} from './utils/tween';

import {
  isRelativeValue,
  relativeToAbsoluteValue
} from './utils/relative';

import transforms from './transforms';

import Prop from './prop';

const defaultOptions = {
  target: null,
  targetIndex: 0,

  duration: [],
  from: null,
  to: null,
  easing: 'linear',
  round: false,

  edgeClassName: false,
  immediateRender: true,
  instance: null
};

const EDGE = {
  BEFORE: 'before',
  AFTER: 'after'
};

const CLASSNAMES = {
  BEFORE: 'cabelo-before',
  INSIDE: 'cabelo-inside',
  AFTER: 'cabelo-after'
};

//
const cachedTargets = [];

class Tween {
  constructor(tween) {
    this._tween = assign(defaultOptions, tween);
    this.target = this._tween.target;
    this.targetIndex = this._tween.targetIndex;
    this.instance = this._tween.instance;

    this.id = this.getID();
    this.duration = this.getDuration();
    this.easing = normalizeEasing(this._tween.easing);
    this.props = this.getProps();
    this.edge = null;
  }

  getID() {
    let index = cachedTargets.indexOf(this.target);

    if (index === -1) {
      cachedTargets.push(this.target);
      index = cachedTargets.indexOf(this.target);
    }

    return index;
  }

  getDuration() {
    let durations = getFunctionValue(this._tween.duration, this.target, this.targetIndex);

    if (durations.length && (this._tween.from || this._tween.to)) {
      console.warn('You can\'t use `duration` and `from` or `to` in the same tween.', this._tween);
    }

    if (this._tween.from && this._tween.to) {
      durations = [this._tween.from, this._tween.to];
    } else if (this._tween.to) {
      durations = [0, this._tween.to];
    }

    return durations
      .map((duration) => {
        if (isRelativeValue(duration)) {
          return relativeToAbsoluteValue(
            this.target,
            duration,
            this.instance.getClientHeight,
            this.instance.getScrollTop
          );
        }

        return duration;
      });
  }

  getProps() {
    return Object
      .keys(this._tween)
      // remove default properties
      .filter((p) => !defaultOptions.hasOwnProperty(p))
      .map((name) => {
        return new Prop({
          id: this.id,

          target: this.target,
          targetIndex: this._tween.targetIndex,

          name: name,
          values: this._tween[name],

          easing: this.easing,
          round: this._tween.round
        });
      });
  }

  getMaxDuration() {
    return maxValue(this.duration);
  }

  updateClass(className) {
    if (!this._tween.edgeClassName) {
      return;
    }

    const toRemove = Object.values(CLASSNAMES)
      .filter((name) => name !== className);

    this.target.classList.add(className);
    this.target.classList.remove(...toRemove);
  }

  updateEdges(scrollTop) {
    const durations = this.duration;

    const firstDuration = durations[0];
    const lastDuration = durations[durations.length - 1];
    const beforeFirst = scrollTop < firstDuration;
    const afterLast = scrollTop > lastDuration;

    if (beforeFirst || afterLast) {
      if (beforeFirst && this.edge !== EDGE.BEFORE || afterLast && this.edge !== EDGE.AFTER) {
        if (beforeFirst && !this._tween.immediateRender) {
          return;
        }

        if (beforeFirst) {
          this.updateClass(CLASSNAMES.BEFORE);
        } else {
          this.updateClass(CLASSNAMES.AFTER);
        }

        this.props.forEach((prop) => {
          prop.updateEdge(beforeFirst, afterLast);
        });

        updateTransform(this.target, this.id);
      }

      this.edge = beforeFirst ? EDGE.BEFORE : EDGE.AFTER;
    } else if (this.edge !== null) {
      this.updateClass(CLASSNAMES.INSIDE);
      this.edge = null;
    }
  }

  updateProgress(scrollTop) {
    this.duration
      .forEach((duration, index) => {
        const nextIndex = index + 1;

        const start = duration;
        const end = this.duration[nextIndex];

        if (scrollTop >= start && scrollTop <= end) {
          const progress = (scrollTop - start) / (end - start);

          this.props.forEach((prop) => {
            prop.tick(progress, { index, nextIndex }, scrollTop);
          });

          updateTransform(this.target, this.id);
        }
      });
  }

  tick(scrollTop) {
    // If we are before/after the first/last duration, set the styles accordingly.
    this.updateEdges(scrollTop);

    // Update props progress
    this.updateProgress(scrollTop);
  }
}

export default Tween;
