var TemplateView = Backbone.View.extend({
    // Classes
    SubViews: false,
    ChildView: false,
    EmptyView: false,

    // Contructed classes
    subViews: [],
    childViews: {},
    emptyView: false,
    parentView: false,
    ancestorView: false,

    // Context globals
    templateConfig: false,
    templateEl: false,
    templateHTML: false,
    sourceDOM: false,
    currentAncestorEl: false,
    lastUpdateCid: false,

    // Context booleans
    isRendered: false,
    isDestroyed: false,
    isAncestorView: false,
    isRendering: false,

    // Event functions
    onBeforeRender: function() {},
    onRender: function() {},
    onBeforeDestroy: function() {},
    onDestroy: function() {},

    constructor: function(options) {

        for(var key in options) {
            this[key] = options[key]
        }

        if(!this.parentView) {
            this.ancestorView = this;
            this.isAncestorView = true;
        }

        if(!this.model
           && this.parentView
           && this.parentView.model) {
            this.model = this.parentView.model;
        }

        if(!this.collection
           && this.parentView
           && this.parentView.collection) {
            this.collection = this.parentView.collection;
        }

        if(this.collection) {
            this.listenTo(this.collection, 'add', this._onCollectionAdd);
            this.listenTo(this.collection, 'remove', this._onCollectionRemove);
            this.listenTo(this.collection, 'change', this._onCollectionChange);
        }

        if(this.model) {
            this.listenTo(this.model, 'change', this._onModelChange);
        }

        if(this.initialize) {
            this.initialize(options);
        }

        if(this.ChildView
           && this.collection
           && this.collection.length) {
            this._addChildViews();
        }

        if(this.EmptyView) {
            this._addEmptyView();
        }

        if(this.SubViews) {
            this._addSubViews();
        }

    },
    render: function() {
        this.onBeforeRender();

        if(this.isAncestorView) {
            this._initSourceDOM();
        }

        var renderedHTML = this._renderTemplate();

        this.setElement(renderedHTML);
        
        if(!this.isRendered && this.isAncestorView) {
            this.currentAncestorEl = this.el;
        }

        this._attachSourceElement();

        if(this.ChildView && this.collection) {
            if(this.collection.length) {
                this._renderChildViews();
            }
            else if(this.EmptyView) {
                this._renderEmptyView();
            }
        }

        if(this.subViews.length) {
            this._renderSubViews();
        }

        if(this.isAncestorView) {
            this._updateDOM();
        }

        this.onRender();

        this.isRendered = true;

        return this;
    },
    destroy: function() {
        if (this.isDestroyed) { return this; }

        this.onBeforeDestroy();

        this.isDestroyed = true;

        this.onDestroy();

        this.isRendered = false;

        this.remove();

        return this;
    },
    _initSourceDOM: function() {
        this.sourceDOM = document.createElement('template');
        document.getElementsByTagName('body')[0].appendChild(this.sourceDOM);
    },
    _updateDOM: function() {
        if(!this.isRendered) {
            var attachOptions = this._getAttachOptions(this.templateConfig);
            var method = attachOptions.method;
            var selector = attachOptions.selector;

            var $targetEl;
            if(selector.indexOf('&') == 0) {
                $targetEl = this.parentView.$el.find(selector.substring(1)); 
            } else {
                $targetEl = $(selector); 
            }

            $(this.el)[method]($targetEl);
        } else {
            morphdom(this.currentAncestorEl, this.el, {
                onBeforeElUpdated: function(fromEl, toEl) {
                    var events = $._data(toEl, "events");
                    for(var type in events) {
                        for(var i = 0; i < events[type].length; i++) {
                            var handler = events[type][i].handler;
                            var selector = events[type][i].selector;

                            var $el = $(fromEl);
                            if(selector != '') {
                                $el = $el.find(selector); 
                            }

                            $el.unbind(type).bind(type, handler);
                        }
                    }
                    return true;
                }
            })
        }

        $(this.sourceDOM).remove();
    },
    _onCollectionAdd: function(model) {
        if(this.ancestorView.lastUpdateCid != model.cid) {
            if(this.ChildView) {
                if(this.EmptyView && this.emptyView.isRendered) {
                    this.emptyView.destroy();    
                }
                this.childViews[model.cid] = new this.ChildView({model:model,parentView:this,ancestorView:this.ancestorView});
            }

            this.ancestorView.render();
            this.ancestorView.lastUpdateCid = model.cid;
        }
    },
    _onCollectionRemove: function(model) {
        if(this.ChildView) {
            this.childViews[model.cid].destroy();
            delete this.childViews[model.cid];
        }
        this.ancestorView.render();
    },
    _onCollectionChange: function(model) {
        if(this.ancestorView.lastUpdateCid != model.cid) {
            this.ancestorView.render();
            this.ancestorView.lastUpdateCid = model.cid;
        }
    },
    _onModelChange: function(model) {
        if(this.ancestorView.lastUpdateCid != model.cid) {
            this.ancestorView.render();
            this.ancestorView.lastUpdateCid = model.cid;
        }
    },
    _renderTemplate: function() {

        this.templateEl = document.querySelector(this.template);
        this.templateConfig = $(this.templateEl).data();
        this.templateHTML = this.templateEl.innerHTML;

        var context = {};

        if(this.model) {
            context = $.extend({}, context, this.model.attributes);
        }

        if(this.templateContext) {
            context = $.extend({}, context, this.templateContext());
        }

        var html = nunjucks.renderString(this.templateHTML, context);

        return html;
    },
    _addChildViews: function() {
        for(var i = 0; i < this.collection.length; i++) {
            var model = this.collection.at(i);
            var childView = new this.ChildView({model:model,parentView:this,ancestorView:this.ancestorView});
            this.childViews[model.cid] = childView;
        }
    },
    _renderChildViews: function() {
        for(var cid in this.childViews) {
            this.childViews[cid].render();
        }
    },
    _addEmptyView: function() {
        this.emptyView = new this.EmptyView({parentView:this,ancestorView:this.ancestorView});
    },
    _renderEmptyView: function() {
        this.emptyView.render();
    },
    _addSubViews: function() {
        this.subViews = [];
        for(var i = 0; i < this.SubViews.length; i++) {
            this.subViews[i] = new this.SubViews[i]({parentView:this,ancestorView:this.ancestorView});
        }
    },
    _renderSubViews: function() {
        if(this.subViews.length) {
            for(var i = 0; i < this.subViews.length; i++) {
                this.subViews[i].render();
            }
        }
    },
    _attachSourceElement: function() {
        var attachOptions = this._getAttachOptions(this.templateConfig);
        var method = attachOptions.method;
        var selector = attachOptions.selector;

        if(typeof selector == 'undefined') {
            return
        }

        if(this.isAncestorView) {
            $(this.el).appendTo(this.sourceDOM);
        } else {
            var targetEl;
            if(selector.length == 1 && selector.indexOf("&") != -1) {
                targetEl = this.parentView.el;
            }
            else if(selector.indexOf("&") != -1) {
                selector = selector.substring(1);
                targetEl = this.parentView.$el.find(selector);
            }
            else {
                targetEl = $(this.ancestorView.sourceDOM).find(selector);
            }
            $(this.el)[method](targetEl);
        }
    },
    _getAttachOptions: function(templateConfig) {
        var method, selector;
        if(templateConfig.prependTo) {
            method = 'prependTo';
            selector = this.templateConfig.prependTo;
        }
        else if (templateConfig.appendTo) {
            method = 'appendTo';
            selector = this.templateConfig.appendTo;
        }
        else if (templateConfig.insertAfter) {
            method = 'insertAfter';
            selector = this.templateConfig.insertAfter;
        }
        else if (templateConfig.insertBefore) {
            method = 'insertBefore';
            selector = this.templateConfig.insertBefore;
        }
        return { method:method, selector:selector };
    },
    // We no longer want to ensure, so just set it if possible
    _ensureElement: function() {
        if (this.el) {
            this.setElement(_.result(this, 'el'));
        }
    }
});