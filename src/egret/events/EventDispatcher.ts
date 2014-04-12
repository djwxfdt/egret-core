/**
 * Copyright (c) Egret-Labs.org. Permission is hereby granted, free of charge,
 * to any person obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom
 * the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/// <reference path="../debug/DEBUG.ts"/>
/// <reference path="IEventDispatcher.ts"/>

module ns_egret {
    /**
     * @class EventDispatcher
     * EventDispatcher是egret的事件派发器类，负责进行事件的发送和侦听。
     * @stable A
     */
    export class EventDispatcher implements IEventDispatcher {

        /**
         * EventDispatcher 类是可调度事件的所有类的基类。EventDispatcher 类实现 IEventDispatcher 接口
         * ，并且是 DisplayObject 类的基类。EventDispatcher 类允许显示列表上的任何对象都是一个事件目标，
         * 同样允许使用 IEventDispatcher 接口的方法。
         */
        public constructor(target:IEventDispatcher = null) {
            if (target)
                this.target = target;
            else
                this.target = this;
        }

        /**
         * 事件抛出对象
         */
        private target:IEventDispatcher;
        /**
         * 引擎内部调用
         * @private
         */
        public _eventsMap:Object = {};
        /**
         * 引擎内部调用
         * @private
         */
        public _captureEventsMap:Object = {};

        /**
         * 引擎内部调用
         * @private
         */
        public _isUseCapture:Boolean = false;

        /**
         * 添加事件侦听器
         * @param type 事件的类型。
         * @param listener 处理事件的侦听器函数。此函数必须接受 Event 对象作为其唯一的参数，并且不能返回任何结果，
         * 如下面的示例所示： function(evt:Event):void 函数可以有任何名称。
         * @param thisObject 侦听函数绑定的this对象
         * @param useCapture 确定侦听器是运行于捕获阶段还是运行于目标和冒泡阶段。如果将 useCapture 设置为 true，
         * 则侦听器只在捕获阶段处理事件，而不在目标或冒泡阶段处理事件。如果 useCapture 为 false，则侦听器只在目标或冒泡阶段处理事件。
         * 要在所有三个阶段都侦听事件，请调用 addEventListener 两次：一次将 useCapture 设置为 true，一次将 useCapture 设置为 false。
         * @param  priority 事件侦听器的优先级。优先级由一个带符号的 32 位整数指定。数字越大，优先级越高。优先级为 n 的所有侦听器会在
         * 优先级为 n -1 的侦听器之前得到处理。如果两个或更多个侦听器共享相同的优先级，则按照它们的添加顺序进行处理。默认优先级为 0。
         * @stable A
         * todo:GitHub文档
         */
        public addEventListener(type:string, listener:Function, thisObject:any, useCapture:Boolean = false, priority:number = 0):void {
            if (DEBUG && DEBUG.ADD_EVENT_LISTENER) {
                DEBUG.checkAddEventListener(type, listener, thisObject, useCapture, priority);
            }
            var eventMap:Object = useCapture ? this._captureEventsMap : this._eventsMap;
            var list:Array = eventMap[type];
            var insertIndex:number = -1;
            if (list) {
                var length:number = list.length;
                for (var i:number = 0; i < length; i++) {
                    var bin:any = list[i];
                    if (bin.listener === listener) {
                        return;
                    }
                    if (insertIndex == -1 && bin.priority <= priority) {
                        insertIndex = i;
                    }
                }
            }
            else {
                list = eventMap[type] = [];
            }

            var eventBin = {listener: listener, thisObject: thisObject, priority: priority};
            if (insertIndex != -1) {
                list.splice(insertIndex, 0, eventBin);
            }
            else {
                list.push(eventBin);
            }
        }

        /**
         * 移除事件侦听器
         * @param type 事件名
         * @param listener 侦听函数
         * @param thisObject 侦听函数绑定的this对象
         * @param useCapture 是否使用捕获，这个属性只在显示列表中生效。
         * @stable A
         */
        public removeEventListener(type:string, listener:Function, useCapture:Boolean = false):void {
            var eventMap:Object = useCapture ? this._captureEventsMap : this._eventsMap;
            var list:Array = eventMap[type];
            if (!list) {
                return;
            }
            var length:number = list.length;
            for (var i:number = 0; i < length; i++) {
                var bin:any = list[i];
                if (bin.listener === listener) {
                    list.splice(i, 1);
                    break;
                }
            }
            if(list.length==0){
                delete eventMap[type];
            }
        }

        /**
         * 检测是否存在监听器
         * @param type 事件名
         * @returns {*}
         * @stable A
         */
        public hasEventListener(type:string):boolean {
            return (this._eventsMap[type] || this._captureEventsMap[type]);
        }


        /**
         * 将事件分派到事件流中。事件目标是对其调用 dispatchEvent() 方法的 EventDispatcher 对象。
         * @param event 调度到事件流中的 Event 对象。如果正在重新分派事件，则会自动创建此事件的一个克隆。 在调度了事件后，其 target 属性将无法更改，因此您必须创建此事件的一个新副本以能够重新调度。
         * @return 如果成功调度了事件，则值为 true。值 false 表示失败或对事件调用了 preventDefault()。
         */
        public dispatchEvent(event:Event):boolean {
            event._reset();
            event._target = this.target;
            event._setCurrentTarget(this.target);
            return this._notifyListener(event);
        }

        public _notifyListener(event:Event):boolean{
            var eventMap:Object = event._eventPhase==1 ? this._captureEventsMap : this._eventsMap;
            var list:Array = eventMap[type];
            if (!list) {
                return true;
            }
            var length:number = list.length;
            for(var i:number = 0;i<length;i++){
                var eventBin:any = list[i];
                eventBin.listener.apply(eventBin.thisObject,[event]);
                if(event._isPropagationImmediateStopped){
                    break;
                }
            }
            return !event.isDefaultPrevented();
        }

        private static reuseEvent:Event = new Event("");
        /**
         * 派发一个包含了特定参数的事件到所有注册了特定类型侦听器的对象中。 这个方法使用了一个内部的事件对象池因避免重复的分配导致的额外开销。
         * @param type 事件类型
         * @param bubbles 是否冒泡，默认false
         * @param data 附加数据(可选)
         */
        public dispatchEventWith(type:String, bubbles:Boolean = false, data:Object = null):void{
            var event:Event = EventDispatcher.reuseEvent;
            event._type = type;
            event._bubbles = bubbles;
            event.data = data;
            this.dispatchEvent(event);
        }
    }
}
