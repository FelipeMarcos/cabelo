import Emittery from 'emittery';
import omit from 'lodash.omit';

import Targets from './targets';
import Tween from './tween';
import SimpleTween from './simple-tween';

import is from './utils/is';
import { maxValue } from './utils';
import { isPropATween, mapPropToTween } from './utils/tween';

const DIRECTION = {
  UP: 'up',
  DOWN: 'down'
};

const defaultOptions = {
  container: document.scrollingElement || document.documentElement,
  forceHeight: true,
  debug: false
};

class Instance {
  constructor(options) {
    this.options = Object.assign({}, defaultOptions, options);

    this.container = this.options.container;
    this.tweens = [];
    this.ticking = false;
    this.began = false;
    this.lastScrollPosition = 0;
    this.scrollPosition = 0;

    this.add = this.add.bind(this);
    this.refresh  = this.refresh.bind(this);
    this.onScroll = this.onScroll.bind(this);

    this.events();
  }

  add(t) {
    // get extra tweens from current tween if there are any
    const propsToRemove = this.getNestedTweens(t);
    t = omit(t, propsToRemove);

    // create new target
    const targets = new Targets(t.targets);

    targets.forEach((target, targetIndex) => {
      const newTween = Object.assign({}, omit(t, ['targets']), { target, targetIndex });
      this.tweens.push( new Tween(newTween) );
    });

    return this;
  }

  hook(t) {
    const tween = new SimpleTween(t);
    this.tweens.push(tween);

    return this;
  }

  tick() {
    this.tweens.forEach((tween) => tween.tick(this.scrollPosition));
  }

  onScroll() {
    this.lastScrollPosition = this.scrollPosition;
    this.scrollPosition = this.getScrollTop();

    if (this.ticking) {
      return;
    }

    requestAnimationFrame(() => {
      this.tick();
      this.ticking = false;

      this.emitter.emit('update', {
        scrollPosition: this.scrollPosition,
        direction: this.getDirection()
      });
    });

    this.ticking = true;

    if ( this.scrollPosition === 0 && !this.began ) {
      this.began = true;
      this.emitter.emit('begin');
    }

    if ( this.scrollPosition >= this.getTotalDuration() ) {
      this.completed = true;
      this.emitter.emit('complete');
    }
  }

  getNestedTweens(tween) {
    const removeProps = [];

    Object.keys(tween)
      .forEach((p) => {
        const values = tween[p];

        if ( isPropATween(values) ) {
          this.add( mapPropToTween(p, values, tween) );
          removeProps.push(p);
        }
      });

    return removeProps;
  }

  getScrollTop() {
    return this.container.scrollTop || 0;
  }

  getTotalDuration() {
    const durations = this.tweens
      .map((tween) => tween.getMaxDuration());

    return maxValue(durations);
  }

  getDirection() {
    return this.scrollPosition >= this.lastScrollPosition ? DIRECTION.DOWN : DIRECTION.UP;
  }

  getHeight() {
    return this.container.clientHeight;
  }

  // emitter
  on(eventName, listener) {
    this.emitter.on(eventName, listener);
    return this;
  }

  off(eventName, listener) {
    this.emitter.off(eventName, listener);
    return this;
  }

  //
  events() {
    this.emitter = new Emittery();

    this.scrollEl = this.container === document.documentElement ? window : this.container;

    this.scrollEl.addEventListener('scroll', this.onScroll);

    if (typeof window.ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(this.refresh);
      this.ro.observe(this.container);
    } else {
      this.scrollEl.addEventListener('resize', this.onScroll);
    }
  }

  //
  reflow() {
    const height = this.getHeight();
    const duration = this.getTotalDuration();

    if (this.options.forceHeight) {
      this.container.style.height = `${height + duration}px`;
    }

    return this;
  }

  refresh() {
    this.reflow();
    return this;
  }

  destroy() {
    this.scrollEl.removeEventListener('scroll', this.onScroll);

    if (this.ro) {
      this.ro.disconnect();
    } else {
      this.scrollEl.removeEventListener('resize', this.refresh);
    }

    return this;
  }

  init() {
    this.refresh();
    this.onScroll();

    return this;
  }
}

export default Instance;
