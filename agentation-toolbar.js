var qf=Object.create;var Fa=Object.defineProperty;var e1=Object.getOwnPropertyDescriptor;var t1=Object.getOwnPropertyNames;var n1=Object.getPrototypeOf,r1=Object.prototype.hasOwnProperty;var St=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var o1=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of t1(t))!r1.call(e,o)&&o!==n&&Fa(e,o,{get:()=>t[o],enumerable:!(r=e1(t,o))||r.enumerable});return e};var $t=(e,t,n)=>(n=e!=null?qf(n1(e)):{},o1(t||!e||!e.__esModule?Fa(n,"default",{value:e,enumerable:!0}):n,e));var Ga=St(j=>{"use strict";var ir=Symbol.for("react.element"),l1=Symbol.for("react.portal"),i1=Symbol.for("react.fragment"),s1=Symbol.for("react.strict_mode"),a1=Symbol.for("react.profiler"),u1=Symbol.for("react.provider"),c1=Symbol.for("react.context"),d1=Symbol.for("react.forward_ref"),f1=Symbol.for("react.suspense"),_1=Symbol.for("react.memo"),p1=Symbol.for("react.lazy"),Aa=Symbol.iterator;function m1(e){return e===null||typeof e!="object"?null:(e=Aa&&e[Aa]||e["@@iterator"],typeof e=="function"?e:null)}var Wa={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},Ua=Object.assign,Ha={};function En(e,t,n){this.props=e,this.context=t,this.refs=Ha,this.updater=n||Wa}En.prototype.isReactComponent={};En.prototype.setState=function(e,t){if(typeof e!="object"&&typeof e!="function"&&e!=null)throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,t,"setState")};En.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")};function Xa(){}Xa.prototype=En.prototype;function Ul(e,t,n){this.props=e,this.context=t,this.refs=Ha,this.updater=n||Wa}var Hl=Ul.prototype=new Xa;Hl.constructor=Ul;Ua(Hl,En.prototype);Hl.isPureReactComponent=!0;var Ya=Array.isArray,Qa=Object.prototype.hasOwnProperty,Xl={current:null},Va={key:!0,ref:!0,__self:!0,__source:!0};function Za(e,t,n){var r,o={},l=null,i=null;if(t!=null)for(r in t.ref!==void 0&&(i=t.ref),t.key!==void 0&&(l=""+t.key),t)Qa.call(t,r)&&!Va.hasOwnProperty(r)&&(o[r]=t[r]);var s=arguments.length-2;if(s===1)o.children=n;else if(1<s){for(var a=Array(s),d=0;d<s;d++)a[d]=arguments[d+2];o.children=a}if(e&&e.defaultProps)for(r in s=e.defaultProps,s)o[r]===void 0&&(o[r]=s[r]);return{$$typeof:ir,type:e,key:l,ref:i,props:o,_owner:Xl.current}}function h1(e,t){return{$$typeof:ir,type:e.type,key:t,ref:e.ref,props:e.props,_owner:e._owner}}function Ql(e){return typeof e=="object"&&e!==null&&e.$$typeof===ir}function y1(e){var t={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,function(n){return t[n]})}var Ba=/\/+/g;function Wl(e,t){return typeof e=="object"&&e!==null&&e.key!=null?y1(""+e.key):t.toString(36)}function _o(e,t,n,r,o){var l=typeof e;(l==="undefined"||l==="boolean")&&(e=null);var i=!1;if(e===null)i=!0;else switch(l){case"string":case"number":i=!0;break;case"object":switch(e.$$typeof){case ir:case l1:i=!0}}if(i)return i=e,o=o(i),e=r===""?"."+Wl(i,0):r,Ya(o)?(n="",e!=null&&(n=e.replace(Ba,"$&/")+"/"),_o(o,t,n,"",function(d){return d})):o!=null&&(Ql(o)&&(o=h1(o,n+(!o.key||i&&i.key===o.key?"":(""+o.key).replace(Ba,"$&/")+"/")+e)),t.push(o)),1;if(i=0,r=r===""?".":r+":",Ya(e))for(var s=0;s<e.length;s++){l=e[s];var a=r+Wl(l,s);i+=_o(l,t,n,a,o)}else if(a=m1(e),typeof a=="function")for(e=a.call(e),s=0;!(l=e.next()).done;)l=l.value,a=r+Wl(l,s++),i+=_o(l,t,n,a,o);else if(l==="object")throw t=String(e),Error("Objects are not valid as a React child (found: "+(t==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":t)+"). If you meant to render a collection of children, use an array instead.");return i}function fo(e,t,n){if(e==null)return e;var r=[],o=0;return _o(e,r,"","",function(l){return t.call(n,l,o++)}),r}function g1(e){if(e._status===-1){var t=e._result;t=t(),t.then(function(n){(e._status===0||e._status===-1)&&(e._status=1,e._result=n)},function(n){(e._status===0||e._status===-1)&&(e._status=2,e._result=n)}),e._status===-1&&(e._status=0,e._result=t)}if(e._status===1)return e._result.default;throw e._result}var Ne={current:null},po={transition:null},v1={ReactCurrentDispatcher:Ne,ReactCurrentBatchConfig:po,ReactCurrentOwner:Xl};function Ka(){throw Error("act(...) is not supported in production builds of React.")}j.Children={map:fo,forEach:function(e,t,n){fo(e,function(){t.apply(this,arguments)},n)},count:function(e){var t=0;return fo(e,function(){t++}),t},toArray:function(e){return fo(e,function(t){return t})||[]},only:function(e){if(!Ql(e))throw Error("React.Children.only expected to receive a single React element child.");return e}};j.Component=En;j.Fragment=i1;j.Profiler=a1;j.PureComponent=Ul;j.StrictMode=s1;j.Suspense=f1;j.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=v1;j.act=Ka;j.cloneElement=function(e,t,n){if(e==null)throw Error("React.cloneElement(...): The argument must be a React element, but you passed "+e+".");var r=Ua({},e.props),o=e.key,l=e.ref,i=e._owner;if(t!=null){if(t.ref!==void 0&&(l=t.ref,i=Xl.current),t.key!==void 0&&(o=""+t.key),e.type&&e.type.defaultProps)var s=e.type.defaultProps;for(a in t)Qa.call(t,a)&&!Va.hasOwnProperty(a)&&(r[a]=t[a]===void 0&&s!==void 0?s[a]:t[a])}var a=arguments.length-2;if(a===1)r.children=n;else if(1<a){s=Array(a);for(var d=0;d<a;d++)s[d]=arguments[d+2];r.children=s}return{$$typeof:ir,type:e.type,key:o,ref:l,props:r,_owner:i}};j.createContext=function(e){return e={$$typeof:c1,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null,_defaultValue:null,_globalName:null},e.Provider={$$typeof:u1,_context:e},e.Consumer=e};j.createElement=Za;j.createFactory=function(e){var t=Za.bind(null,e);return t.type=e,t};j.createRef=function(){return{current:null}};j.forwardRef=function(e){return{$$typeof:d1,render:e}};j.isValidElement=Ql;j.lazy=function(e){return{$$typeof:p1,_payload:{_status:-1,_result:e},_init:g1}};j.memo=function(e,t){return{$$typeof:_1,type:e,compare:t===void 0?null:t}};j.startTransition=function(e){var t=po.transition;po.transition={};try{e()}finally{po.transition=t}};j.unstable_act=Ka;j.useCallback=function(e,t){return Ne.current.useCallback(e,t)};j.useContext=function(e){return Ne.current.useContext(e)};j.useDebugValue=function(){};j.useDeferredValue=function(e){return Ne.current.useDeferredValue(e)};j.useEffect=function(e,t){return Ne.current.useEffect(e,t)};j.useId=function(){return Ne.current.useId()};j.useImperativeHandle=function(e,t,n){return Ne.current.useImperativeHandle(e,t,n)};j.useInsertionEffect=function(e,t){return Ne.current.useInsertionEffect(e,t)};j.useLayoutEffect=function(e,t){return Ne.current.useLayoutEffect(e,t)};j.useMemo=function(e,t){return Ne.current.useMemo(e,t)};j.useReducer=function(e,t,n){return Ne.current.useReducer(e,t,n)};j.useRef=function(e){return Ne.current.useRef(e)};j.useState=function(e){return Ne.current.useState(e)};j.useSyncExternalStore=function(e,t,n){return Ne.current.useSyncExternalStore(e,t,n)};j.useTransition=function(){return Ne.current.useTransition()};j.version="18.3.1"});var Ln=St((J_,Ja)=>{"use strict";Ja.exports=Ga()});var au=St(K=>{"use strict";function Gl(e,t){var n=e.length;e.push(t);e:for(;0<n;){var r=n-1>>>1,o=e[r];if(0<mo(o,t))e[r]=t,e[n]=o,n=r;else break e}}function tt(e){return e.length===0?null:e[0]}function yo(e){if(e.length===0)return null;var t=e[0],n=e.pop();if(n!==t){e[0]=n;e:for(var r=0,o=e.length,l=o>>>1;r<l;){var i=2*(r+1)-1,s=e[i],a=i+1,d=e[a];if(0>mo(s,n))a<o&&0>mo(d,s)?(e[r]=d,e[a]=n,r=a):(e[r]=s,e[i]=n,r=i);else if(a<o&&0>mo(d,n))e[r]=d,e[a]=n,r=a;else break e}}return t}function mo(e,t){var n=e.sortIndex-t.sortIndex;return n!==0?n:e.id-t.id}typeof performance=="object"&&typeof performance.now=="function"?(qa=performance,K.unstable_now=function(){return qa.now()}):(Vl=Date,eu=Vl.now(),K.unstable_now=function(){return Vl.now()-eu});var qa,Vl,eu,pt=[],Dt=[],k1=1,Qe=null,xe=3,go=!1,rn=!1,ar=!1,ru=typeof setTimeout=="function"?setTimeout:null,ou=typeof clearTimeout=="function"?clearTimeout:null,tu=typeof setImmediate<"u"?setImmediate:null;typeof navigator<"u"&&navigator.scheduling!==void 0&&navigator.scheduling.isInputPending!==void 0&&navigator.scheduling.isInputPending.bind(navigator.scheduling);function Jl(e){for(var t=tt(Dt);t!==null;){if(t.callback===null)yo(Dt);else if(t.startTime<=e)yo(Dt),t.sortIndex=t.expirationTime,Gl(pt,t);else break;t=tt(Dt)}}function ql(e){if(ar=!1,Jl(e),!rn)if(tt(pt)!==null)rn=!0,ti(ei);else{var t=tt(Dt);t!==null&&ni(ql,t.startTime-e)}}function ei(e,t){rn=!1,ar&&(ar=!1,ou(ur),ur=-1),go=!0;var n=xe;try{for(Jl(t),Qe=tt(pt);Qe!==null&&(!(Qe.expirationTime>t)||e&&!su());){var r=Qe.callback;if(typeof r=="function"){Qe.callback=null,xe=Qe.priorityLevel;var o=r(Qe.expirationTime<=t);t=K.unstable_now(),typeof o=="function"?Qe.callback=o:Qe===tt(pt)&&yo(pt),Jl(t)}else yo(pt);Qe=tt(pt)}if(Qe!==null)var l=!0;else{var i=tt(Dt);i!==null&&ni(ql,i.startTime-t),l=!1}return l}finally{Qe=null,xe=n,go=!1}}var vo=!1,ho=null,ur=-1,lu=5,iu=-1;function su(){return!(K.unstable_now()-iu<lu)}function Zl(){if(ho!==null){var e=K.unstable_now();iu=e;var t=!0;try{t=ho(!0,e)}finally{t?sr():(vo=!1,ho=null)}}else vo=!1}var sr;typeof tu=="function"?sr=function(){tu(Zl)}:typeof MessageChannel<"u"?(Kl=new MessageChannel,nu=Kl.port2,Kl.port1.onmessage=Zl,sr=function(){nu.postMessage(null)}):sr=function(){ru(Zl,0)};var Kl,nu;function ti(e){ho=e,vo||(vo=!0,sr())}function ni(e,t){ur=ru(function(){e(K.unstable_now())},t)}K.unstable_IdlePriority=5;K.unstable_ImmediatePriority=1;K.unstable_LowPriority=4;K.unstable_NormalPriority=3;K.unstable_Profiling=null;K.unstable_UserBlockingPriority=2;K.unstable_cancelCallback=function(e){e.callback=null};K.unstable_continueExecution=function(){rn||go||(rn=!0,ti(ei))};K.unstable_forceFrameRate=function(e){0>e||125<e?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):lu=0<e?Math.floor(1e3/e):5};K.unstable_getCurrentPriorityLevel=function(){return xe};K.unstable_getFirstCallbackNode=function(){return tt(pt)};K.unstable_next=function(e){switch(xe){case 1:case 2:case 3:var t=3;break;default:t=xe}var n=xe;xe=t;try{return e()}finally{xe=n}};K.unstable_pauseExecution=function(){};K.unstable_requestPaint=function(){};K.unstable_runWithPriority=function(e,t){switch(e){case 1:case 2:case 3:case 4:case 5:break;default:e=3}var n=xe;xe=e;try{return t()}finally{xe=n}};K.unstable_scheduleCallback=function(e,t,n){var r=K.unstable_now();switch(typeof n=="object"&&n!==null?(n=n.delay,n=typeof n=="number"&&0<n?r+n:r):n=r,e){case 1:var o=-1;break;case 2:o=250;break;case 5:o=1073741823;break;case 4:o=1e4;break;default:o=5e3}return o=n+o,e={id:k1++,callback:t,priorityLevel:e,startTime:n,expirationTime:o,sortIndex:-1},n>r?(e.sortIndex=n,Gl(Dt,e),tt(pt)===null&&e===tt(Dt)&&(ar?(ou(ur),ur=-1):ar=!0,ni(ql,n-r))):(e.sortIndex=o,Gl(pt,e),rn||go||(rn=!0,ti(ei))),e};K.unstable_shouldYield=su;K.unstable_wrapCallback=function(e){var t=xe;return function(){var n=xe;xe=t;try{return e.apply(this,arguments)}finally{xe=n}}}});var cu=St((ep,uu)=>{"use strict";uu.exports=au()});var mf=St(He=>{"use strict";var x1=Ln(),We=cu();function x(e){for(var t="https://reactjs.org/docs/error-decoder.html?invariant="+e,n=1;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n]);return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}var yc=new Set,Tr={};function yn(e,t){Qn(e,t),Qn(e+"Capture",t)}function Qn(e,t){for(Tr[e]=t,e=0;e<t.length;e++)yc.add(t[e])}var Mt=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),Ei=Object.prototype.hasOwnProperty,w1=/^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,du={},fu={};function C1(e){return Ei.call(fu,e)?!0:Ei.call(du,e)?!1:w1.test(e)?fu[e]=!0:(du[e]=!0,!1)}function S1(e,t,n,r){if(n!==null&&n.type===0)return!1;switch(typeof t){case"function":case"symbol":return!0;case"boolean":return r?!1:n!==null?!n.acceptsBooleans:(e=e.toLowerCase().slice(0,5),e!=="data-"&&e!=="aria-");default:return!1}}function E1(e,t,n,r){if(t===null||typeof t>"u"||S1(e,t,n,r))return!0;if(r)return!1;if(n!==null)switch(n.type){case 3:return!t;case 4:return t===!1;case 5:return isNaN(t);case 6:return isNaN(t)||1>t}return!1}function Te(e,t,n,r,o,l,i){this.acceptsBooleans=t===2||t===3||t===4,this.attributeName=r,this.attributeNamespace=o,this.mustUseProperty=n,this.propertyName=e,this.type=t,this.sanitizeURL=l,this.removeEmptyString=i}var ke={};"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(e){ke[e]=new Te(e,0,!1,e,null,!1,!1)});[["acceptCharset","accept-charset"],["className","class"],["htmlFor","for"],["httpEquiv","http-equiv"]].forEach(function(e){var t=e[0];ke[t]=new Te(t,1,!1,e[1],null,!1,!1)});["contentEditable","draggable","spellCheck","value"].forEach(function(e){ke[e]=new Te(e,2,!1,e.toLowerCase(),null,!1,!1)});["autoReverse","externalResourcesRequired","focusable","preserveAlpha"].forEach(function(e){ke[e]=new Te(e,2,!1,e,null,!1,!1)});"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(e){ke[e]=new Te(e,3,!1,e.toLowerCase(),null,!1,!1)});["checked","multiple","muted","selected"].forEach(function(e){ke[e]=new Te(e,3,!0,e,null,!1,!1)});["capture","download"].forEach(function(e){ke[e]=new Te(e,4,!1,e,null,!1,!1)});["cols","rows","size","span"].forEach(function(e){ke[e]=new Te(e,6,!1,e,null,!1,!1)});["rowSpan","start"].forEach(function(e){ke[e]=new Te(e,5,!1,e.toLowerCase(),null,!1,!1)});var ys=/[\-:]([a-z])/g;function gs(e){return e[1].toUpperCase()}"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(e){var t=e.replace(ys,gs);ke[t]=new Te(t,1,!1,e,null,!1,!1)});"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(e){var t=e.replace(ys,gs);ke[t]=new Te(t,1,!1,e,"http://www.w3.org/1999/xlink",!1,!1)});["xml:base","xml:lang","xml:space"].forEach(function(e){var t=e.replace(ys,gs);ke[t]=new Te(t,1,!1,e,"http://www.w3.org/XML/1998/namespace",!1,!1)});["tabIndex","crossOrigin"].forEach(function(e){ke[e]=new Te(e,1,!1,e.toLowerCase(),null,!1,!1)});ke.xlinkHref=new Te("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1);["src","href","action","formAction"].forEach(function(e){ke[e]=new Te(e,1,!1,e.toLowerCase(),null,!0,!0)});function vs(e,t,n,r){var o=ke.hasOwnProperty(t)?ke[t]:null;(o!==null?o.type!==0:r||!(2<t.length)||t[0]!=="o"&&t[0]!=="O"||t[1]!=="n"&&t[1]!=="N")&&(E1(t,n,o,r)&&(n=null),r||o===null?C1(t)&&(n===null?e.removeAttribute(t):e.setAttribute(t,""+n)):o.mustUseProperty?e[o.propertyName]=n===null?o.type===3?!1:"":n:(t=o.attributeName,r=o.attributeNamespace,n===null?e.removeAttribute(t):(o=o.type,n=o===3||o===4&&n===!0?"":""+n,r?e.setAttributeNS(r,t,n):e.setAttribute(t,n))))}var zt=x1.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,ko=Symbol.for("react.element"),bn=Symbol.for("react.portal"),Mn=Symbol.for("react.fragment"),ks=Symbol.for("react.strict_mode"),Li=Symbol.for("react.profiler"),gc=Symbol.for("react.provider"),vc=Symbol.for("react.context"),xs=Symbol.for("react.forward_ref"),Pi=Symbol.for("react.suspense"),Ni=Symbol.for("react.suspense_list"),ws=Symbol.for("react.memo"),jt=Symbol.for("react.lazy");Symbol.for("react.scope");Symbol.for("react.debug_trace_mode");var kc=Symbol.for("react.offscreen");Symbol.for("react.legacy_hidden");Symbol.for("react.cache");Symbol.for("react.tracing_marker");var _u=Symbol.iterator;function cr(e){return e===null||typeof e!="object"?null:(e=_u&&e[_u]||e["@@iterator"],typeof e=="function"?e:null)}var se=Object.assign,ri;function gr(e){if(ri===void 0)try{throw Error()}catch(n){var t=n.stack.trim().match(/\n( *(at )?)/);ri=t&&t[1]||""}return`
`+ri+e}var oi=!1;function li(e,t){if(!e||oi)return"";oi=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(t)if(t=function(){throw Error()},Object.defineProperty(t.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(t,[])}catch(d){var r=d}Reflect.construct(e,[],t)}else{try{t.call()}catch(d){r=d}e.call(t.prototype)}else{try{throw Error()}catch(d){r=d}e()}}catch(d){if(d&&r&&typeof d.stack=="string"){for(var o=d.stack.split(`
`),l=r.stack.split(`
`),i=o.length-1,s=l.length-1;1<=i&&0<=s&&o[i]!==l[s];)s--;for(;1<=i&&0<=s;i--,s--)if(o[i]!==l[s]){if(i!==1||s!==1)do if(i--,s--,0>s||o[i]!==l[s]){var a=`
`+o[i].replace(" at new "," at ");return e.displayName&&a.includes("<anonymous>")&&(a=a.replace("<anonymous>",e.displayName)),a}while(1<=i&&0<=s);break}}}finally{oi=!1,Error.prepareStackTrace=n}return(e=e?e.displayName||e.name:"")?gr(e):""}function L1(e){switch(e.tag){case 5:return gr(e.type);case 16:return gr("Lazy");case 13:return gr("Suspense");case 19:return gr("SuspenseList");case 0:case 2:case 15:return e=li(e.type,!1),e;case 11:return e=li(e.type.render,!1),e;case 1:return e=li(e.type,!0),e;default:return""}}function bi(e){if(e==null)return null;if(typeof e=="function")return e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case Mn:return"Fragment";case bn:return"Portal";case Li:return"Profiler";case ks:return"StrictMode";case Pi:return"Suspense";case Ni:return"SuspenseList"}if(typeof e=="object")switch(e.$$typeof){case vc:return(e.displayName||"Context")+".Consumer";case gc:return(e._context.displayName||"Context")+".Provider";case xs:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case ws:return t=e.displayName||null,t!==null?t:bi(e.type)||"Memo";case jt:t=e._payload,e=e._init;try{return bi(e(t))}catch{}}return null}function P1(e){var t=e.type;switch(e.tag){case 24:return"Cache";case 9:return(t.displayName||"Context")+".Consumer";case 10:return(t._context.displayName||"Context")+".Provider";case 18:return"DehydratedFragment";case 11:return e=t.render,e=e.displayName||e.name||"",t.displayName||(e!==""?"ForwardRef("+e+")":"ForwardRef");case 7:return"Fragment";case 5:return t;case 4:return"Portal";case 3:return"Root";case 6:return"Text";case 16:return bi(t);case 8:return t===ks?"StrictMode":"Mode";case 22:return"Offscreen";case 12:return"Profiler";case 21:return"Scope";case 13:return"Suspense";case 19:return"SuspenseList";case 25:return"TracingMarker";case 1:case 0:case 17:case 2:case 14:case 15:if(typeof t=="function")return t.displayName||t.name||null;if(typeof t=="string")return t}return null}function Jt(e){switch(typeof e){case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function xc(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function N1(e){var t=xc(e)?"checked":"value",n=Object.getOwnPropertyDescriptor(e.constructor.prototype,t),r=""+e[t];if(!e.hasOwnProperty(t)&&typeof n<"u"&&typeof n.get=="function"&&typeof n.set=="function"){var o=n.get,l=n.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return o.call(this)},set:function(i){r=""+i,l.call(this,i)}}),Object.defineProperty(e,t,{enumerable:n.enumerable}),{getValue:function(){return r},setValue:function(i){r=""+i},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function xo(e){e._valueTracker||(e._valueTracker=N1(e))}function wc(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var n=t.getValue(),r="";return e&&(r=xc(e)?e.checked?"true":"false":e.value),e=r,e!==n?(t.setValue(e),!0):!1}function Zo(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}function Mi(e,t){var n=t.checked;return se({},t,{defaultChecked:void 0,defaultValue:void 0,value:void 0,checked:n??e._wrapperState.initialChecked})}function pu(e,t){var n=t.defaultValue==null?"":t.defaultValue,r=t.checked!=null?t.checked:t.defaultChecked;n=Jt(t.value!=null?t.value:n),e._wrapperState={initialChecked:r,initialValue:n,controlled:t.type==="checkbox"||t.type==="radio"?t.checked!=null:t.value!=null}}function Cc(e,t){t=t.checked,t!=null&&vs(e,"checked",t,!1)}function Ti(e,t){Cc(e,t);var n=Jt(t.value),r=t.type;if(n!=null)r==="number"?(n===0&&e.value===""||e.value!=n)&&(e.value=""+n):e.value!==""+n&&(e.value=""+n);else if(r==="submit"||r==="reset"){e.removeAttribute("value");return}t.hasOwnProperty("value")?Ii(e,t.type,n):t.hasOwnProperty("defaultValue")&&Ii(e,t.type,Jt(t.defaultValue)),t.checked==null&&t.defaultChecked!=null&&(e.defaultChecked=!!t.defaultChecked)}function mu(e,t,n){if(t.hasOwnProperty("value")||t.hasOwnProperty("defaultValue")){var r=t.type;if(!(r!=="submit"&&r!=="reset"||t.value!==void 0&&t.value!==null))return;t=""+e._wrapperState.initialValue,n||t===e.value||(e.value=t),e.defaultValue=t}n=e.name,n!==""&&(e.name=""),e.defaultChecked=!!e._wrapperState.initialChecked,n!==""&&(e.name=n)}function Ii(e,t,n){(t!=="number"||Zo(e.ownerDocument)!==e)&&(n==null?e.defaultValue=""+e._wrapperState.initialValue:e.defaultValue!==""+n&&(e.defaultValue=""+n))}var vr=Array.isArray;function Yn(e,t,n,r){if(e=e.options,t){t={};for(var o=0;o<n.length;o++)t["$"+n[o]]=!0;for(n=0;n<e.length;n++)o=t.hasOwnProperty("$"+e[n].value),e[n].selected!==o&&(e[n].selected=o),o&&r&&(e[n].defaultSelected=!0)}else{for(n=""+Jt(n),t=null,o=0;o<e.length;o++){if(e[o].value===n){e[o].selected=!0,r&&(e[o].defaultSelected=!0);return}t!==null||e[o].disabled||(t=e[o])}t!==null&&(t.selected=!0)}}function Oi(e,t){if(t.dangerouslySetInnerHTML!=null)throw Error(x(91));return se({},t,{value:void 0,defaultValue:void 0,children:""+e._wrapperState.initialValue})}function hu(e,t){var n=t.value;if(n==null){if(n=t.children,t=t.defaultValue,n!=null){if(t!=null)throw Error(x(92));if(vr(n)){if(1<n.length)throw Error(x(93));n=n[0]}t=n}t==null&&(t=""),n=t}e._wrapperState={initialValue:Jt(n)}}function Sc(e,t){var n=Jt(t.value),r=Jt(t.defaultValue);n!=null&&(n=""+n,n!==e.value&&(e.value=n),t.defaultValue==null&&e.defaultValue!==n&&(e.defaultValue=n)),r!=null&&(e.defaultValue=""+r)}function yu(e){var t=e.textContent;t===e._wrapperState.initialValue&&t!==""&&t!==null&&(e.value=t)}function Ec(e){switch(e){case"svg":return"http://www.w3.org/2000/svg";case"math":return"http://www.w3.org/1998/Math/MathML";default:return"http://www.w3.org/1999/xhtml"}}function zi(e,t){return e==null||e==="http://www.w3.org/1999/xhtml"?Ec(t):e==="http://www.w3.org/2000/svg"&&t==="foreignObject"?"http://www.w3.org/1999/xhtml":e}var wo,Lc=(function(e){return typeof MSApp<"u"&&MSApp.execUnsafeLocalFunction?function(t,n,r,o){MSApp.execUnsafeLocalFunction(function(){return e(t,n,r,o)})}:e})(function(e,t){if(e.namespaceURI!=="http://www.w3.org/2000/svg"||"innerHTML"in e)e.innerHTML=t;else{for(wo=wo||document.createElement("div"),wo.innerHTML="<svg>"+t.valueOf().toString()+"</svg>",t=wo.firstChild;e.firstChild;)e.removeChild(e.firstChild);for(;t.firstChild;)e.appendChild(t.firstChild)}});function Ir(e,t){if(t){var n=e.firstChild;if(n&&n===e.lastChild&&n.nodeType===3){n.nodeValue=t;return}}e.textContent=t}var wr={animationIterationCount:!0,aspectRatio:!0,borderImageOutset:!0,borderImageSlice:!0,borderImageWidth:!0,boxFlex:!0,boxFlexGroup:!0,boxOrdinalGroup:!0,columnCount:!0,columns:!0,flex:!0,flexGrow:!0,flexPositive:!0,flexShrink:!0,flexNegative:!0,flexOrder:!0,gridArea:!0,gridRow:!0,gridRowEnd:!0,gridRowSpan:!0,gridRowStart:!0,gridColumn:!0,gridColumnEnd:!0,gridColumnSpan:!0,gridColumnStart:!0,fontWeight:!0,lineClamp:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,tabSize:!0,widows:!0,zIndex:!0,zoom:!0,fillOpacity:!0,floodOpacity:!0,stopOpacity:!0,strokeDasharray:!0,strokeDashoffset:!0,strokeMiterlimit:!0,strokeOpacity:!0,strokeWidth:!0},b1=["Webkit","ms","Moz","O"];Object.keys(wr).forEach(function(e){b1.forEach(function(t){t=t+e.charAt(0).toUpperCase()+e.substring(1),wr[t]=wr[e]})});function Pc(e,t,n){return t==null||typeof t=="boolean"||t===""?"":n||typeof t!="number"||t===0||wr.hasOwnProperty(e)&&wr[e]?(""+t).trim():t+"px"}function Nc(e,t){e=e.style;for(var n in t)if(t.hasOwnProperty(n)){var r=n.indexOf("--")===0,o=Pc(n,t[n],r);n==="float"&&(n="cssFloat"),r?e.setProperty(n,o):e[n]=o}}var M1=se({menuitem:!0},{area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0});function $i(e,t){if(t){if(M1[e]&&(t.children!=null||t.dangerouslySetInnerHTML!=null))throw Error(x(137,e));if(t.dangerouslySetInnerHTML!=null){if(t.children!=null)throw Error(x(60));if(typeof t.dangerouslySetInnerHTML!="object"||!("__html"in t.dangerouslySetInnerHTML))throw Error(x(61))}if(t.style!=null&&typeof t.style!="object")throw Error(x(62))}}function Di(e,t){if(e.indexOf("-")===-1)return typeof t.is=="string";switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var Ri=null;function Cs(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var ji=null,Bn=null,Wn=null;function gu(e){if(e=Kr(e)){if(typeof ji!="function")throw Error(x(280));var t=e.stateNode;t&&(t=Cl(t),ji(e.stateNode,e.type,t))}}function bc(e){Bn?Wn?Wn.push(e):Wn=[e]:Bn=e}function Mc(){if(Bn){var e=Bn,t=Wn;if(Wn=Bn=null,gu(e),t)for(e=0;e<t.length;e++)gu(t[e])}}function Tc(e,t){return e(t)}function Ic(){}var ii=!1;function Oc(e,t,n){if(ii)return e(t,n);ii=!0;try{return Tc(e,t,n)}finally{ii=!1,(Bn!==null||Wn!==null)&&(Ic(),Mc())}}function Or(e,t){var n=e.stateNode;if(n===null)return null;var r=Cl(n);if(r===null)return null;n=r[t];e:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(r=!r.disabled)||(e=e.type,r=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!r;break e;default:e=!1}if(e)return null;if(n&&typeof n!="function")throw Error(x(231,t,typeof n));return n}var Fi=!1;if(Mt)try{Pn={},Object.defineProperty(Pn,"passive",{get:function(){Fi=!0}}),window.addEventListener("test",Pn,Pn),window.removeEventListener("test",Pn,Pn)}catch{Fi=!1}var Pn;function T1(e,t,n,r,o,l,i,s,a){var d=Array.prototype.slice.call(arguments,3);try{t.apply(n,d)}catch(g){this.onError(g)}}var Cr=!1,Ko=null,Go=!1,Ai=null,I1={onError:function(e){Cr=!0,Ko=e}};function O1(e,t,n,r,o,l,i,s,a){Cr=!1,Ko=null,T1.apply(I1,arguments)}function z1(e,t,n,r,o,l,i,s,a){if(O1.apply(this,arguments),Cr){if(Cr){var d=Ko;Cr=!1,Ko=null}else throw Error(x(198));Go||(Go=!0,Ai=d)}}function gn(e){var t=e,n=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,(t.flags&4098)!==0&&(n=t.return),e=t.return;while(e)}return t.tag===3?n:null}function zc(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function vu(e){if(gn(e)!==e)throw Error(x(188))}function $1(e){var t=e.alternate;if(!t){if(t=gn(e),t===null)throw Error(x(188));return t!==e?null:e}for(var n=e,r=t;;){var o=n.return;if(o===null)break;var l=o.alternate;if(l===null){if(r=o.return,r!==null){n=r;continue}break}if(o.child===l.child){for(l=o.child;l;){if(l===n)return vu(o),e;if(l===r)return vu(o),t;l=l.sibling}throw Error(x(188))}if(n.return!==r.return)n=o,r=l;else{for(var i=!1,s=o.child;s;){if(s===n){i=!0,n=o,r=l;break}if(s===r){i=!0,r=o,n=l;break}s=s.sibling}if(!i){for(s=l.child;s;){if(s===n){i=!0,n=l,r=o;break}if(s===r){i=!0,r=l,n=o;break}s=s.sibling}if(!i)throw Error(x(189))}}if(n.alternate!==r)throw Error(x(190))}if(n.tag!==3)throw Error(x(188));return n.stateNode.current===n?e:t}function $c(e){return e=$1(e),e!==null?Dc(e):null}function Dc(e){if(e.tag===5||e.tag===6)return e;for(e=e.child;e!==null;){var t=Dc(e);if(t!==null)return t;e=e.sibling}return null}var Rc=We.unstable_scheduleCallback,ku=We.unstable_cancelCallback,D1=We.unstable_shouldYield,R1=We.unstable_requestPaint,ce=We.unstable_now,j1=We.unstable_getCurrentPriorityLevel,Ss=We.unstable_ImmediatePriority,jc=We.unstable_UserBlockingPriority,Jo=We.unstable_NormalPriority,F1=We.unstable_LowPriority,Fc=We.unstable_IdlePriority,vl=null,gt=null;function A1(e){if(gt&&typeof gt.onCommitFiberRoot=="function")try{gt.onCommitFiberRoot(vl,e,void 0,(e.current.flags&128)===128)}catch{}}var it=Math.clz32?Math.clz32:W1,Y1=Math.log,B1=Math.LN2;function W1(e){return e>>>=0,e===0?32:31-(Y1(e)/B1|0)|0}var Co=64,So=4194304;function kr(e){switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return e&4194240;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return e&130023424;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 1073741824;default:return e}}function qo(e,t){var n=e.pendingLanes;if(n===0)return 0;var r=0,o=e.suspendedLanes,l=e.pingedLanes,i=n&268435455;if(i!==0){var s=i&~o;s!==0?r=kr(s):(l&=i,l!==0&&(r=kr(l)))}else i=n&~o,i!==0?r=kr(i):l!==0&&(r=kr(l));if(r===0)return 0;if(t!==0&&t!==r&&(t&o)===0&&(o=r&-r,l=t&-t,o>=l||o===16&&(l&4194240)!==0))return t;if((r&4)!==0&&(r|=n&16),t=e.entangledLanes,t!==0)for(e=e.entanglements,t&=r;0<t;)n=31-it(t),o=1<<n,r|=e[n],t&=~o;return r}function U1(e,t){switch(e){case 1:case 2:case 4:return t+250;case 8:case 16:case 32:case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return-1;case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function H1(e,t){for(var n=e.suspendedLanes,r=e.pingedLanes,o=e.expirationTimes,l=e.pendingLanes;0<l;){var i=31-it(l),s=1<<i,a=o[i];a===-1?((s&n)===0||(s&r)!==0)&&(o[i]=U1(s,t)):a<=t&&(e.expiredLanes|=s),l&=~s}}function Yi(e){return e=e.pendingLanes&-1073741825,e!==0?e:e&1073741824?1073741824:0}function Ac(){var e=Co;return Co<<=1,(Co&4194240)===0&&(Co=64),e}function si(e){for(var t=[],n=0;31>n;n++)t.push(e);return t}function Vr(e,t,n){e.pendingLanes|=t,t!==536870912&&(e.suspendedLanes=0,e.pingedLanes=0),e=e.eventTimes,t=31-it(t),e[t]=n}function X1(e,t){var n=e.pendingLanes&~t;e.pendingLanes=t,e.suspendedLanes=0,e.pingedLanes=0,e.expiredLanes&=t,e.mutableReadLanes&=t,e.entangledLanes&=t,t=e.entanglements;var r=e.eventTimes;for(e=e.expirationTimes;0<n;){var o=31-it(n),l=1<<o;t[o]=0,r[o]=-1,e[o]=-1,n&=~l}}function Es(e,t){var n=e.entangledLanes|=t;for(e=e.entanglements;n;){var r=31-it(n),o=1<<r;o&t|e[r]&t&&(e[r]|=t),n&=~o}}var Q=0;function Yc(e){return e&=-e,1<e?4<e?(e&268435455)!==0?16:536870912:4:1}var Bc,Ls,Wc,Uc,Hc,Bi=!1,Eo=[],Ut=null,Ht=null,Xt=null,zr=new Map,$r=new Map,At=[],Q1="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");function xu(e,t){switch(e){case"focusin":case"focusout":Ut=null;break;case"dragenter":case"dragleave":Ht=null;break;case"mouseover":case"mouseout":Xt=null;break;case"pointerover":case"pointerout":zr.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":$r.delete(t.pointerId)}}function dr(e,t,n,r,o,l){return e===null||e.nativeEvent!==l?(e={blockedOn:t,domEventName:n,eventSystemFlags:r,nativeEvent:l,targetContainers:[o]},t!==null&&(t=Kr(t),t!==null&&Ls(t)),e):(e.eventSystemFlags|=r,t=e.targetContainers,o!==null&&t.indexOf(o)===-1&&t.push(o),e)}function V1(e,t,n,r,o){switch(t){case"focusin":return Ut=dr(Ut,e,t,n,r,o),!0;case"dragenter":return Ht=dr(Ht,e,t,n,r,o),!0;case"mouseover":return Xt=dr(Xt,e,t,n,r,o),!0;case"pointerover":var l=o.pointerId;return zr.set(l,dr(zr.get(l)||null,e,t,n,r,o)),!0;case"gotpointercapture":return l=o.pointerId,$r.set(l,dr($r.get(l)||null,e,t,n,r,o)),!0}return!1}function Xc(e){var t=sn(e.target);if(t!==null){var n=gn(t);if(n!==null){if(t=n.tag,t===13){if(t=zc(n),t!==null){e.blockedOn=t,Hc(e.priority,function(){Wc(n)});return}}else if(t===3&&n.stateNode.current.memoizedState.isDehydrated){e.blockedOn=n.tag===3?n.stateNode.containerInfo:null;return}}}e.blockedOn=null}function Fo(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var n=Wi(e.domEventName,e.eventSystemFlags,t[0],e.nativeEvent);if(n===null){n=e.nativeEvent;var r=new n.constructor(n.type,n);Ri=r,n.target.dispatchEvent(r),Ri=null}else return t=Kr(n),t!==null&&Ls(t),e.blockedOn=n,!1;t.shift()}return!0}function wu(e,t,n){Fo(e)&&n.delete(t)}function Z1(){Bi=!1,Ut!==null&&Fo(Ut)&&(Ut=null),Ht!==null&&Fo(Ht)&&(Ht=null),Xt!==null&&Fo(Xt)&&(Xt=null),zr.forEach(wu),$r.forEach(wu)}function fr(e,t){e.blockedOn===t&&(e.blockedOn=null,Bi||(Bi=!0,We.unstable_scheduleCallback(We.unstable_NormalPriority,Z1)))}function Dr(e){function t(o){return fr(o,e)}if(0<Eo.length){fr(Eo[0],e);for(var n=1;n<Eo.length;n++){var r=Eo[n];r.blockedOn===e&&(r.blockedOn=null)}}for(Ut!==null&&fr(Ut,e),Ht!==null&&fr(Ht,e),Xt!==null&&fr(Xt,e),zr.forEach(t),$r.forEach(t),n=0;n<At.length;n++)r=At[n],r.blockedOn===e&&(r.blockedOn=null);for(;0<At.length&&(n=At[0],n.blockedOn===null);)Xc(n),n.blockedOn===null&&At.shift()}var Un=zt.ReactCurrentBatchConfig,el=!0;function K1(e,t,n,r){var o=Q,l=Un.transition;Un.transition=null;try{Q=1,Ps(e,t,n,r)}finally{Q=o,Un.transition=l}}function G1(e,t,n,r){var o=Q,l=Un.transition;Un.transition=null;try{Q=4,Ps(e,t,n,r)}finally{Q=o,Un.transition=l}}function Ps(e,t,n,r){if(el){var o=Wi(e,t,n,r);if(o===null)pi(e,t,r,tl,n),xu(e,r);else if(V1(o,e,t,n,r))r.stopPropagation();else if(xu(e,r),t&4&&-1<Q1.indexOf(e)){for(;o!==null;){var l=Kr(o);if(l!==null&&Bc(l),l=Wi(e,t,n,r),l===null&&pi(e,t,r,tl,n),l===o)break;o=l}o!==null&&r.stopPropagation()}else pi(e,t,r,null,n)}}var tl=null;function Wi(e,t,n,r){if(tl=null,e=Cs(r),e=sn(e),e!==null)if(t=gn(e),t===null)e=null;else if(n=t.tag,n===13){if(e=zc(t),e!==null)return e;e=null}else if(n===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null);return tl=e,null}function Qc(e){switch(e){case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 1;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"toggle":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 4;case"message":switch(j1()){case Ss:return 1;case jc:return 4;case Jo:case F1:return 16;case Fc:return 536870912;default:return 16}default:return 16}}var Bt=null,Ns=null,Ao=null;function Vc(){if(Ao)return Ao;var e,t=Ns,n=t.length,r,o="value"in Bt?Bt.value:Bt.textContent,l=o.length;for(e=0;e<n&&t[e]===o[e];e++);var i=n-e;for(r=1;r<=i&&t[n-r]===o[l-r];r++);return Ao=o.slice(e,1<r?1-r:void 0)}function Yo(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function Lo(){return!0}function Cu(){return!1}function Ue(e){function t(n,r,o,l,i){this._reactName=n,this._targetInst=o,this.type=r,this.nativeEvent=l,this.target=i,this.currentTarget=null;for(var s in e)e.hasOwnProperty(s)&&(n=e[s],this[s]=n?n(l):l[s]);return this.isDefaultPrevented=(l.defaultPrevented!=null?l.defaultPrevented:l.returnValue===!1)?Lo:Cu,this.isPropagationStopped=Cu,this}return se(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var n=this.nativeEvent;n&&(n.preventDefault?n.preventDefault():typeof n.returnValue!="unknown"&&(n.returnValue=!1),this.isDefaultPrevented=Lo)},stopPropagation:function(){var n=this.nativeEvent;n&&(n.stopPropagation?n.stopPropagation():typeof n.cancelBubble!="unknown"&&(n.cancelBubble=!0),this.isPropagationStopped=Lo)},persist:function(){},isPersistent:Lo}),t}var er={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},bs=Ue(er),Zr=se({},er,{view:0,detail:0}),J1=Ue(Zr),ai,ui,_r,kl=se({},Zr,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Ms,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==_r&&(_r&&e.type==="mousemove"?(ai=e.screenX-_r.screenX,ui=e.screenY-_r.screenY):ui=ai=0,_r=e),ai)},movementY:function(e){return"movementY"in e?e.movementY:ui}}),Su=Ue(kl),q1=se({},kl,{dataTransfer:0}),e0=Ue(q1),t0=se({},Zr,{relatedTarget:0}),ci=Ue(t0),n0=se({},er,{animationName:0,elapsedTime:0,pseudoElement:0}),r0=Ue(n0),o0=se({},er,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),l0=Ue(o0),i0=se({},er,{data:0}),Eu=Ue(i0),s0={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},a0={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},u0={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function c0(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=u0[e])?!!t[e]:!1}function Ms(){return c0}var d0=se({},Zr,{key:function(e){if(e.key){var t=s0[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=Yo(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?a0[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Ms,charCode:function(e){return e.type==="keypress"?Yo(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?Yo(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),f0=Ue(d0),_0=se({},kl,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),Lu=Ue(_0),p0=se({},Zr,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Ms}),m0=Ue(p0),h0=se({},er,{propertyName:0,elapsedTime:0,pseudoElement:0}),y0=Ue(h0),g0=se({},kl,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),v0=Ue(g0),k0=[9,13,27,32],Ts=Mt&&"CompositionEvent"in window,Sr=null;Mt&&"documentMode"in document&&(Sr=document.documentMode);var x0=Mt&&"TextEvent"in window&&!Sr,Zc=Mt&&(!Ts||Sr&&8<Sr&&11>=Sr),Pu=" ",Nu=!1;function Kc(e,t){switch(e){case"keyup":return k0.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function Gc(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var Tn=!1;function w0(e,t){switch(e){case"compositionend":return Gc(t);case"keypress":return t.which!==32?null:(Nu=!0,Pu);case"textInput":return e=t.data,e===Pu&&Nu?null:e;default:return null}}function C0(e,t){if(Tn)return e==="compositionend"||!Ts&&Kc(e,t)?(e=Vc(),Ao=Ns=Bt=null,Tn=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return Zc&&t.locale!=="ko"?null:t.data;default:return null}}var S0={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function bu(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!S0[e.type]:t==="textarea"}function Jc(e,t,n,r){bc(r),t=nl(t,"onChange"),0<t.length&&(n=new bs("onChange","change",null,n,r),e.push({event:n,listeners:t}))}var Er=null,Rr=null;function E0(e){ud(e,0)}function xl(e){var t=zn(e);if(wc(t))return e}function L0(e,t){if(e==="change")return t}var qc=!1;Mt&&(Mt?(No="oninput"in document,No||(di=document.createElement("div"),di.setAttribute("oninput","return;"),No=typeof di.oninput=="function"),Po=No):Po=!1,qc=Po&&(!document.documentMode||9<document.documentMode));var Po,No,di;function Mu(){Er&&(Er.detachEvent("onpropertychange",ed),Rr=Er=null)}function ed(e){if(e.propertyName==="value"&&xl(Rr)){var t=[];Jc(t,Rr,e,Cs(e)),Oc(E0,t)}}function P0(e,t,n){e==="focusin"?(Mu(),Er=t,Rr=n,Er.attachEvent("onpropertychange",ed)):e==="focusout"&&Mu()}function N0(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return xl(Rr)}function b0(e,t){if(e==="click")return xl(t)}function M0(e,t){if(e==="input"||e==="change")return xl(t)}function T0(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var at=typeof Object.is=="function"?Object.is:T0;function jr(e,t){if(at(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var n=Object.keys(e),r=Object.keys(t);if(n.length!==r.length)return!1;for(r=0;r<n.length;r++){var o=n[r];if(!Ei.call(t,o)||!at(e[o],t[o]))return!1}return!0}function Tu(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function Iu(e,t){var n=Tu(e);e=0;for(var r;n;){if(n.nodeType===3){if(r=e+n.textContent.length,e<=t&&r>=t)return{node:n,offset:t-e};e=r}e:{for(;n;){if(n.nextSibling){n=n.nextSibling;break e}n=n.parentNode}n=void 0}n=Tu(n)}}function td(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?td(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function nd(){for(var e=window,t=Zo();t instanceof e.HTMLIFrameElement;){try{var n=typeof t.contentWindow.location.href=="string"}catch{n=!1}if(n)e=t.contentWindow;else break;t=Zo(e.document)}return t}function Is(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}function I0(e){var t=nd(),n=e.focusedElem,r=e.selectionRange;if(t!==n&&n&&n.ownerDocument&&td(n.ownerDocument.documentElement,n)){if(r!==null&&Is(n)){if(t=r.start,e=r.end,e===void 0&&(e=t),"selectionStart"in n)n.selectionStart=t,n.selectionEnd=Math.min(e,n.value.length);else if(e=(t=n.ownerDocument||document)&&t.defaultView||window,e.getSelection){e=e.getSelection();var o=n.textContent.length,l=Math.min(r.start,o);r=r.end===void 0?l:Math.min(r.end,o),!e.extend&&l>r&&(o=r,r=l,l=o),o=Iu(n,l);var i=Iu(n,r);o&&i&&(e.rangeCount!==1||e.anchorNode!==o.node||e.anchorOffset!==o.offset||e.focusNode!==i.node||e.focusOffset!==i.offset)&&(t=t.createRange(),t.setStart(o.node,o.offset),e.removeAllRanges(),l>r?(e.addRange(t),e.extend(i.node,i.offset)):(t.setEnd(i.node,i.offset),e.addRange(t)))}}for(t=[],e=n;e=e.parentNode;)e.nodeType===1&&t.push({element:e,left:e.scrollLeft,top:e.scrollTop});for(typeof n.focus=="function"&&n.focus(),n=0;n<t.length;n++)e=t[n],e.element.scrollLeft=e.left,e.element.scrollTop=e.top}}var O0=Mt&&"documentMode"in document&&11>=document.documentMode,In=null,Ui=null,Lr=null,Hi=!1;function Ou(e,t,n){var r=n.window===n?n.document:n.nodeType===9?n:n.ownerDocument;Hi||In==null||In!==Zo(r)||(r=In,"selectionStart"in r&&Is(r)?r={start:r.selectionStart,end:r.selectionEnd}:(r=(r.ownerDocument&&r.ownerDocument.defaultView||window).getSelection(),r={anchorNode:r.anchorNode,anchorOffset:r.anchorOffset,focusNode:r.focusNode,focusOffset:r.focusOffset}),Lr&&jr(Lr,r)||(Lr=r,r=nl(Ui,"onSelect"),0<r.length&&(t=new bs("onSelect","select",null,t,n),e.push({event:t,listeners:r}),t.target=In)))}function bo(e,t){var n={};return n[e.toLowerCase()]=t.toLowerCase(),n["Webkit"+e]="webkit"+t,n["Moz"+e]="moz"+t,n}var On={animationend:bo("Animation","AnimationEnd"),animationiteration:bo("Animation","AnimationIteration"),animationstart:bo("Animation","AnimationStart"),transitionend:bo("Transition","TransitionEnd")},fi={},rd={};Mt&&(rd=document.createElement("div").style,"AnimationEvent"in window||(delete On.animationend.animation,delete On.animationiteration.animation,delete On.animationstart.animation),"TransitionEvent"in window||delete On.transitionend.transition);function wl(e){if(fi[e])return fi[e];if(!On[e])return e;var t=On[e],n;for(n in t)if(t.hasOwnProperty(n)&&n in rd)return fi[e]=t[n];return e}var od=wl("animationend"),ld=wl("animationiteration"),id=wl("animationstart"),sd=wl("transitionend"),ad=new Map,zu="abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");function en(e,t){ad.set(e,t),yn(t,[e])}for(Mo=0;Mo<zu.length;Mo++)To=zu[Mo],$u=To.toLowerCase(),Du=To[0].toUpperCase()+To.slice(1),en($u,"on"+Du);var To,$u,Du,Mo;en(od,"onAnimationEnd");en(ld,"onAnimationIteration");en(id,"onAnimationStart");en("dblclick","onDoubleClick");en("focusin","onFocus");en("focusout","onBlur");en(sd,"onTransitionEnd");Qn("onMouseEnter",["mouseout","mouseover"]);Qn("onMouseLeave",["mouseout","mouseover"]);Qn("onPointerEnter",["pointerout","pointerover"]);Qn("onPointerLeave",["pointerout","pointerover"]);yn("onChange","change click focusin focusout input keydown keyup selectionchange".split(" "));yn("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));yn("onBeforeInput",["compositionend","keypress","textInput","paste"]);yn("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" "));yn("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" "));yn("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var xr="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),z0=new Set("cancel close invalid load scroll toggle".split(" ").concat(xr));function Ru(e,t,n){var r=e.type||"unknown-event";e.currentTarget=n,z1(r,t,void 0,e),e.currentTarget=null}function ud(e,t){t=(t&4)!==0;for(var n=0;n<e.length;n++){var r=e[n],o=r.event;r=r.listeners;e:{var l=void 0;if(t)for(var i=r.length-1;0<=i;i--){var s=r[i],a=s.instance,d=s.currentTarget;if(s=s.listener,a!==l&&o.isPropagationStopped())break e;Ru(o,s,d),l=a}else for(i=0;i<r.length;i++){if(s=r[i],a=s.instance,d=s.currentTarget,s=s.listener,a!==l&&o.isPropagationStopped())break e;Ru(o,s,d),l=a}}}if(Go)throw e=Ai,Go=!1,Ai=null,e}function te(e,t){var n=t[Ki];n===void 0&&(n=t[Ki]=new Set);var r=e+"__bubble";n.has(r)||(cd(t,e,2,!1),n.add(r))}function _i(e,t,n){var r=0;t&&(r|=4),cd(n,e,r,t)}var Io="_reactListening"+Math.random().toString(36).slice(2);function Fr(e){if(!e[Io]){e[Io]=!0,yc.forEach(function(n){n!=="selectionchange"&&(z0.has(n)||_i(n,!1,e),_i(n,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[Io]||(t[Io]=!0,_i("selectionchange",!1,t))}}function cd(e,t,n,r){switch(Qc(t)){case 1:var o=K1;break;case 4:o=G1;break;default:o=Ps}n=o.bind(null,t,n,e),o=void 0,!Fi||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(o=!0),r?o!==void 0?e.addEventListener(t,n,{capture:!0,passive:o}):e.addEventListener(t,n,!0):o!==void 0?e.addEventListener(t,n,{passive:o}):e.addEventListener(t,n,!1)}function pi(e,t,n,r,o){var l=r;if((t&1)===0&&(t&2)===0&&r!==null)e:for(;;){if(r===null)return;var i=r.tag;if(i===3||i===4){var s=r.stateNode.containerInfo;if(s===o||s.nodeType===8&&s.parentNode===o)break;if(i===4)for(i=r.return;i!==null;){var a=i.tag;if((a===3||a===4)&&(a=i.stateNode.containerInfo,a===o||a.nodeType===8&&a.parentNode===o))return;i=i.return}for(;s!==null;){if(i=sn(s),i===null)return;if(a=i.tag,a===5||a===6){r=l=i;continue e}s=s.parentNode}}r=r.return}Oc(function(){var d=l,g=Cs(n),m=[];e:{var h=ad.get(e);if(h!==void 0){var w=bs,C=e;switch(e){case"keypress":if(Yo(n)===0)break e;case"keydown":case"keyup":w=f0;break;case"focusin":C="focus",w=ci;break;case"focusout":C="blur",w=ci;break;case"beforeblur":case"afterblur":w=ci;break;case"click":if(n.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":w=Su;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":w=e0;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":w=m0;break;case od:case ld:case id:w=r0;break;case sd:w=y0;break;case"scroll":w=J1;break;case"wheel":w=v0;break;case"copy":case"cut":case"paste":w=l0;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":w=Lu}var L=(t&4)!==0,J=!L&&e==="scroll",u=L?h!==null?h+"Capture":null:h;L=[];for(var c=d,_;c!==null;){_=c;var k=_.stateNode;if(_.tag===5&&k!==null&&(_=k,u!==null&&(k=Or(c,u),k!=null&&L.push(Ar(c,k,_)))),J)break;c=c.return}0<L.length&&(h=new w(h,C,null,n,g),m.push({event:h,listeners:L}))}}if((t&7)===0){e:{if(h=e==="mouseover"||e==="pointerover",w=e==="mouseout"||e==="pointerout",h&&n!==Ri&&(C=n.relatedTarget||n.fromElement)&&(sn(C)||C[Tt]))break e;if((w||h)&&(h=g.window===g?g:(h=g.ownerDocument)?h.defaultView||h.parentWindow:window,w?(C=n.relatedTarget||n.toElement,w=d,C=C?sn(C):null,C!==null&&(J=gn(C),C!==J||C.tag!==5&&C.tag!==6)&&(C=null)):(w=null,C=d),w!==C)){if(L=Su,k="onMouseLeave",u="onMouseEnter",c="mouse",(e==="pointerout"||e==="pointerover")&&(L=Lu,k="onPointerLeave",u="onPointerEnter",c="pointer"),J=w==null?h:zn(w),_=C==null?h:zn(C),h=new L(k,c+"leave",w,n,g),h.target=J,h.relatedTarget=_,k=null,sn(g)===d&&(L=new L(u,c+"enter",C,n,g),L.target=_,L.relatedTarget=J,k=L),J=k,w&&C)t:{for(L=w,u=C,c=0,_=L;_;_=Nn(_))c++;for(_=0,k=u;k;k=Nn(k))_++;for(;0<c-_;)L=Nn(L),c--;for(;0<_-c;)u=Nn(u),_--;for(;c--;){if(L===u||u!==null&&L===u.alternate)break t;L=Nn(L),u=Nn(u)}L=null}else L=null;w!==null&&ju(m,h,w,L,!1),C!==null&&J!==null&&ju(m,J,C,L,!0)}}e:{if(h=d?zn(d):window,w=h.nodeName&&h.nodeName.toLowerCase(),w==="select"||w==="input"&&h.type==="file")var N=L0;else if(bu(h))if(qc)N=M0;else{N=N0;var M=P0}else(w=h.nodeName)&&w.toLowerCase()==="input"&&(h.type==="checkbox"||h.type==="radio")&&(N=b0);if(N&&(N=N(e,d))){Jc(m,N,n,g);break e}M&&M(e,h,d),e==="focusout"&&(M=h._wrapperState)&&M.controlled&&h.type==="number"&&Ii(h,"number",h.value)}switch(M=d?zn(d):window,e){case"focusin":(bu(M)||M.contentEditable==="true")&&(In=M,Ui=d,Lr=null);break;case"focusout":Lr=Ui=In=null;break;case"mousedown":Hi=!0;break;case"contextmenu":case"mouseup":case"dragend":Hi=!1,Ou(m,n,g);break;case"selectionchange":if(O0)break;case"keydown":case"keyup":Ou(m,n,g)}var T;if(Ts)e:{switch(e){case"compositionstart":var I="onCompositionStart";break e;case"compositionend":I="onCompositionEnd";break e;case"compositionupdate":I="onCompositionUpdate";break e}I=void 0}else Tn?Kc(e,n)&&(I="onCompositionEnd"):e==="keydown"&&n.keyCode===229&&(I="onCompositionStart");I&&(Zc&&n.locale!=="ko"&&(Tn||I!=="onCompositionStart"?I==="onCompositionEnd"&&Tn&&(T=Vc()):(Bt=g,Ns="value"in Bt?Bt.value:Bt.textContent,Tn=!0)),M=nl(d,I),0<M.length&&(I=new Eu(I,e,null,n,g),m.push({event:I,listeners:M}),T?I.data=T:(T=Gc(n),T!==null&&(I.data=T)))),(T=x0?w0(e,n):C0(e,n))&&(d=nl(d,"onBeforeInput"),0<d.length&&(g=new Eu("onBeforeInput","beforeinput",null,n,g),m.push({event:g,listeners:d}),g.data=T))}ud(m,t)})}function Ar(e,t,n){return{instance:e,listener:t,currentTarget:n}}function nl(e,t){for(var n=t+"Capture",r=[];e!==null;){var o=e,l=o.stateNode;o.tag===5&&l!==null&&(o=l,l=Or(e,n),l!=null&&r.unshift(Ar(e,l,o)),l=Or(e,t),l!=null&&r.push(Ar(e,l,o))),e=e.return}return r}function Nn(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5);return e||null}function ju(e,t,n,r,o){for(var l=t._reactName,i=[];n!==null&&n!==r;){var s=n,a=s.alternate,d=s.stateNode;if(a!==null&&a===r)break;s.tag===5&&d!==null&&(s=d,o?(a=Or(n,l),a!=null&&i.unshift(Ar(n,a,s))):o||(a=Or(n,l),a!=null&&i.push(Ar(n,a,s)))),n=n.return}i.length!==0&&e.push({event:t,listeners:i})}var $0=/\r\n?/g,D0=/\u0000|\uFFFD/g;function Fu(e){return(typeof e=="string"?e:""+e).replace($0,`
`).replace(D0,"")}function Oo(e,t,n){if(t=Fu(t),Fu(e)!==t&&n)throw Error(x(425))}function rl(){}var Xi=null,Qi=null;function Vi(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var Zi=typeof setTimeout=="function"?setTimeout:void 0,R0=typeof clearTimeout=="function"?clearTimeout:void 0,Au=typeof Promise=="function"?Promise:void 0,j0=typeof queueMicrotask=="function"?queueMicrotask:typeof Au<"u"?function(e){return Au.resolve(null).then(e).catch(F0)}:Zi;function F0(e){setTimeout(function(){throw e})}function mi(e,t){var n=t,r=0;do{var o=n.nextSibling;if(e.removeChild(n),o&&o.nodeType===8)if(n=o.data,n==="/$"){if(r===0){e.removeChild(o),Dr(t);return}r--}else n!=="$"&&n!=="$?"&&n!=="$!"||r++;n=o}while(n);Dr(t)}function Qt(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?")break;if(t==="/$")return null}}return e}function Yu(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="$"||n==="$!"||n==="$?"){if(t===0)return e;t--}else n==="/$"&&t++}e=e.previousSibling}return null}var tr=Math.random().toString(36).slice(2),yt="__reactFiber$"+tr,Yr="__reactProps$"+tr,Tt="__reactContainer$"+tr,Ki="__reactEvents$"+tr,A0="__reactListeners$"+tr,Y0="__reactHandles$"+tr;function sn(e){var t=e[yt];if(t)return t;for(var n=e.parentNode;n;){if(t=n[Tt]||n[yt]){if(n=t.alternate,t.child!==null||n!==null&&n.child!==null)for(e=Yu(e);e!==null;){if(n=e[yt])return n;e=Yu(e)}return t}e=n,n=e.parentNode}return null}function Kr(e){return e=e[yt]||e[Tt],!e||e.tag!==5&&e.tag!==6&&e.tag!==13&&e.tag!==3?null:e}function zn(e){if(e.tag===5||e.tag===6)return e.stateNode;throw Error(x(33))}function Cl(e){return e[Yr]||null}var Gi=[],$n=-1;function tn(e){return{current:e}}function ne(e){0>$n||(e.current=Gi[$n],Gi[$n]=null,$n--)}function G(e,t){$n++,Gi[$n]=e.current,e.current=t}var qt={},Ee=tn(qt),$e=tn(!1),fn=qt;function Vn(e,t){var n=e.type.contextTypes;if(!n)return qt;var r=e.stateNode;if(r&&r.__reactInternalMemoizedUnmaskedChildContext===t)return r.__reactInternalMemoizedMaskedChildContext;var o={},l;for(l in n)o[l]=t[l];return r&&(e=e.stateNode,e.__reactInternalMemoizedUnmaskedChildContext=t,e.__reactInternalMemoizedMaskedChildContext=o),o}function De(e){return e=e.childContextTypes,e!=null}function ol(){ne($e),ne(Ee)}function Bu(e,t,n){if(Ee.current!==qt)throw Error(x(168));G(Ee,t),G($e,n)}function dd(e,t,n){var r=e.stateNode;if(t=t.childContextTypes,typeof r.getChildContext!="function")return n;r=r.getChildContext();for(var o in r)if(!(o in t))throw Error(x(108,P1(e)||"Unknown",o));return se({},n,r)}function ll(e){return e=(e=e.stateNode)&&e.__reactInternalMemoizedMergedChildContext||qt,fn=Ee.current,G(Ee,e),G($e,$e.current),!0}function Wu(e,t,n){var r=e.stateNode;if(!r)throw Error(x(169));n?(e=dd(e,t,fn),r.__reactInternalMemoizedMergedChildContext=e,ne($e),ne(Ee),G(Ee,e)):ne($e),G($e,n)}var Lt=null,Sl=!1,hi=!1;function fd(e){Lt===null?Lt=[e]:Lt.push(e)}function B0(e){Sl=!0,fd(e)}function nn(){if(!hi&&Lt!==null){hi=!0;var e=0,t=Q;try{var n=Lt;for(Q=1;e<n.length;e++){var r=n[e];do r=r(!0);while(r!==null)}Lt=null,Sl=!1}catch(o){throw Lt!==null&&(Lt=Lt.slice(e+1)),Rc(Ss,nn),o}finally{Q=t,hi=!1}}return null}var Dn=[],Rn=0,il=null,sl=0,Ve=[],Ze=0,_n=null,Pt=1,Nt="";function on(e,t){Dn[Rn++]=sl,Dn[Rn++]=il,il=e,sl=t}function _d(e,t,n){Ve[Ze++]=Pt,Ve[Ze++]=Nt,Ve[Ze++]=_n,_n=e;var r=Pt;e=Nt;var o=32-it(r)-1;r&=~(1<<o),n+=1;var l=32-it(t)+o;if(30<l){var i=o-o%5;l=(r&(1<<i)-1).toString(32),r>>=i,o-=i,Pt=1<<32-it(t)+o|n<<o|r,Nt=l+e}else Pt=1<<l|n<<o|r,Nt=e}function Os(e){e.return!==null&&(on(e,1),_d(e,1,0))}function zs(e){for(;e===il;)il=Dn[--Rn],Dn[Rn]=null,sl=Dn[--Rn],Dn[Rn]=null;for(;e===_n;)_n=Ve[--Ze],Ve[Ze]=null,Nt=Ve[--Ze],Ve[Ze]=null,Pt=Ve[--Ze],Ve[Ze]=null}var Be=null,Ye=null,oe=!1,lt=null;function pd(e,t){var n=Ke(5,null,null,0);n.elementType="DELETED",n.stateNode=t,n.return=e,t=e.deletions,t===null?(e.deletions=[n],e.flags|=16):t.push(n)}function Uu(e,t){switch(e.tag){case 5:var n=e.type;return t=t.nodeType!==1||n.toLowerCase()!==t.nodeName.toLowerCase()?null:t,t!==null?(e.stateNode=t,Be=e,Ye=Qt(t.firstChild),!0):!1;case 6:return t=e.pendingProps===""||t.nodeType!==3?null:t,t!==null?(e.stateNode=t,Be=e,Ye=null,!0):!1;case 13:return t=t.nodeType!==8?null:t,t!==null?(n=_n!==null?{id:Pt,overflow:Nt}:null,e.memoizedState={dehydrated:t,treeContext:n,retryLane:1073741824},n=Ke(18,null,null,0),n.stateNode=t,n.return=e,e.child=n,Be=e,Ye=null,!0):!1;default:return!1}}function Ji(e){return(e.mode&1)!==0&&(e.flags&128)===0}function qi(e){if(oe){var t=Ye;if(t){var n=t;if(!Uu(e,t)){if(Ji(e))throw Error(x(418));t=Qt(n.nextSibling);var r=Be;t&&Uu(e,t)?pd(r,n):(e.flags=e.flags&-4097|2,oe=!1,Be=e)}}else{if(Ji(e))throw Error(x(418));e.flags=e.flags&-4097|2,oe=!1,Be=e}}}function Hu(e){for(e=e.return;e!==null&&e.tag!==5&&e.tag!==3&&e.tag!==13;)e=e.return;Be=e}function zo(e){if(e!==Be)return!1;if(!oe)return Hu(e),oe=!0,!1;var t;if((t=e.tag!==3)&&!(t=e.tag!==5)&&(t=e.type,t=t!=="head"&&t!=="body"&&!Vi(e.type,e.memoizedProps)),t&&(t=Ye)){if(Ji(e))throw md(),Error(x(418));for(;t;)pd(e,t),t=Qt(t.nextSibling)}if(Hu(e),e.tag===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(x(317));e:{for(e=e.nextSibling,t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="/$"){if(t===0){Ye=Qt(e.nextSibling);break e}t--}else n!=="$"&&n!=="$!"&&n!=="$?"||t++}e=e.nextSibling}Ye=null}}else Ye=Be?Qt(e.stateNode.nextSibling):null;return!0}function md(){for(var e=Ye;e;)e=Qt(e.nextSibling)}function Zn(){Ye=Be=null,oe=!1}function $s(e){lt===null?lt=[e]:lt.push(e)}var W0=zt.ReactCurrentBatchConfig;function pr(e,t,n){if(e=n.ref,e!==null&&typeof e!="function"&&typeof e!="object"){if(n._owner){if(n=n._owner,n){if(n.tag!==1)throw Error(x(309));var r=n.stateNode}if(!r)throw Error(x(147,e));var o=r,l=""+e;return t!==null&&t.ref!==null&&typeof t.ref=="function"&&t.ref._stringRef===l?t.ref:(t=function(i){var s=o.refs;i===null?delete s[l]:s[l]=i},t._stringRef=l,t)}if(typeof e!="string")throw Error(x(284));if(!n._owner)throw Error(x(290,e))}return e}function $o(e,t){throw e=Object.prototype.toString.call(t),Error(x(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e))}function Xu(e){var t=e._init;return t(e._payload)}function hd(e){function t(u,c){if(e){var _=u.deletions;_===null?(u.deletions=[c],u.flags|=16):_.push(c)}}function n(u,c){if(!e)return null;for(;c!==null;)t(u,c),c=c.sibling;return null}function r(u,c){for(u=new Map;c!==null;)c.key!==null?u.set(c.key,c):u.set(c.index,c),c=c.sibling;return u}function o(u,c){return u=Gt(u,c),u.index=0,u.sibling=null,u}function l(u,c,_){return u.index=_,e?(_=u.alternate,_!==null?(_=_.index,_<c?(u.flags|=2,c):_):(u.flags|=2,c)):(u.flags|=1048576,c)}function i(u){return e&&u.alternate===null&&(u.flags|=2),u}function s(u,c,_,k){return c===null||c.tag!==6?(c=Ci(_,u.mode,k),c.return=u,c):(c=o(c,_),c.return=u,c)}function a(u,c,_,k){var N=_.type;return N===Mn?g(u,c,_.props.children,k,_.key):c!==null&&(c.elementType===N||typeof N=="object"&&N!==null&&N.$$typeof===jt&&Xu(N)===c.type)?(k=o(c,_.props),k.ref=pr(u,c,_),k.return=u,k):(k=Vo(_.type,_.key,_.props,null,u.mode,k),k.ref=pr(u,c,_),k.return=u,k)}function d(u,c,_,k){return c===null||c.tag!==4||c.stateNode.containerInfo!==_.containerInfo||c.stateNode.implementation!==_.implementation?(c=Si(_,u.mode,k),c.return=u,c):(c=o(c,_.children||[]),c.return=u,c)}function g(u,c,_,k,N){return c===null||c.tag!==7?(c=dn(_,u.mode,k,N),c.return=u,c):(c=o(c,_),c.return=u,c)}function m(u,c,_){if(typeof c=="string"&&c!==""||typeof c=="number")return c=Ci(""+c,u.mode,_),c.return=u,c;if(typeof c=="object"&&c!==null){switch(c.$$typeof){case ko:return _=Vo(c.type,c.key,c.props,null,u.mode,_),_.ref=pr(u,null,c),_.return=u,_;case bn:return c=Si(c,u.mode,_),c.return=u,c;case jt:var k=c._init;return m(u,k(c._payload),_)}if(vr(c)||cr(c))return c=dn(c,u.mode,_,null),c.return=u,c;$o(u,c)}return null}function h(u,c,_,k){var N=c!==null?c.key:null;if(typeof _=="string"&&_!==""||typeof _=="number")return N!==null?null:s(u,c,""+_,k);if(typeof _=="object"&&_!==null){switch(_.$$typeof){case ko:return _.key===N?a(u,c,_,k):null;case bn:return _.key===N?d(u,c,_,k):null;case jt:return N=_._init,h(u,c,N(_._payload),k)}if(vr(_)||cr(_))return N!==null?null:g(u,c,_,k,null);$o(u,_)}return null}function w(u,c,_,k,N){if(typeof k=="string"&&k!==""||typeof k=="number")return u=u.get(_)||null,s(c,u,""+k,N);if(typeof k=="object"&&k!==null){switch(k.$$typeof){case ko:return u=u.get(k.key===null?_:k.key)||null,a(c,u,k,N);case bn:return u=u.get(k.key===null?_:k.key)||null,d(c,u,k,N);case jt:var M=k._init;return w(u,c,_,M(k._payload),N)}if(vr(k)||cr(k))return u=u.get(_)||null,g(c,u,k,N,null);$o(c,k)}return null}function C(u,c,_,k){for(var N=null,M=null,T=c,I=c=0,V=null;T!==null&&I<_.length;I++){T.index>I?(V=T,T=null):V=T.sibling;var z=h(u,T,_[I],k);if(z===null){T===null&&(T=V);break}e&&T&&z.alternate===null&&t(u,T),c=l(z,c,I),M===null?N=z:M.sibling=z,M=z,T=V}if(I===_.length)return n(u,T),oe&&on(u,I),N;if(T===null){for(;I<_.length;I++)T=m(u,_[I],k),T!==null&&(c=l(T,c,I),M===null?N=T:M.sibling=T,M=T);return oe&&on(u,I),N}for(T=r(u,T);I<_.length;I++)V=w(T,u,I,_[I],k),V!==null&&(e&&V.alternate!==null&&T.delete(V.key===null?I:V.key),c=l(V,c,I),M===null?N=V:M.sibling=V,M=V);return e&&T.forEach(function(Fe){return t(u,Fe)}),oe&&on(u,I),N}function L(u,c,_,k){var N=cr(_);if(typeof N!="function")throw Error(x(150));if(_=N.call(_),_==null)throw Error(x(151));for(var M=N=null,T=c,I=c=0,V=null,z=_.next();T!==null&&!z.done;I++,z=_.next()){T.index>I?(V=T,T=null):V=T.sibling;var Fe=h(u,T,z.value,k);if(Fe===null){T===null&&(T=V);break}e&&T&&Fe.alternate===null&&t(u,T),c=l(Fe,c,I),M===null?N=Fe:M.sibling=Fe,M=Fe,T=V}if(z.done)return n(u,T),oe&&on(u,I),N;if(T===null){for(;!z.done;I++,z=_.next())z=m(u,z.value,k),z!==null&&(c=l(z,c,I),M===null?N=z:M.sibling=z,M=z);return oe&&on(u,I),N}for(T=r(u,T);!z.done;I++,z=_.next())z=w(T,u,I,z.value,k),z!==null&&(e&&z.alternate!==null&&T.delete(z.key===null?I:z.key),c=l(z,c,I),M===null?N=z:M.sibling=z,M=z);return e&&T.forEach(function(vn){return t(u,vn)}),oe&&on(u,I),N}function J(u,c,_,k){if(typeof _=="object"&&_!==null&&_.type===Mn&&_.key===null&&(_=_.props.children),typeof _=="object"&&_!==null){switch(_.$$typeof){case ko:e:{for(var N=_.key,M=c;M!==null;){if(M.key===N){if(N=_.type,N===Mn){if(M.tag===7){n(u,M.sibling),c=o(M,_.props.children),c.return=u,u=c;break e}}else if(M.elementType===N||typeof N=="object"&&N!==null&&N.$$typeof===jt&&Xu(N)===M.type){n(u,M.sibling),c=o(M,_.props),c.ref=pr(u,M,_),c.return=u,u=c;break e}n(u,M);break}else t(u,M);M=M.sibling}_.type===Mn?(c=dn(_.props.children,u.mode,k,_.key),c.return=u,u=c):(k=Vo(_.type,_.key,_.props,null,u.mode,k),k.ref=pr(u,c,_),k.return=u,u=k)}return i(u);case bn:e:{for(M=_.key;c!==null;){if(c.key===M)if(c.tag===4&&c.stateNode.containerInfo===_.containerInfo&&c.stateNode.implementation===_.implementation){n(u,c.sibling),c=o(c,_.children||[]),c.return=u,u=c;break e}else{n(u,c);break}else t(u,c);c=c.sibling}c=Si(_,u.mode,k),c.return=u,u=c}return i(u);case jt:return M=_._init,J(u,c,M(_._payload),k)}if(vr(_))return C(u,c,_,k);if(cr(_))return L(u,c,_,k);$o(u,_)}return typeof _=="string"&&_!==""||typeof _=="number"?(_=""+_,c!==null&&c.tag===6?(n(u,c.sibling),c=o(c,_),c.return=u,u=c):(n(u,c),c=Ci(_,u.mode,k),c.return=u,u=c),i(u)):n(u,c)}return J}var Kn=hd(!0),yd=hd(!1),al=tn(null),ul=null,jn=null,Ds=null;function Rs(){Ds=jn=ul=null}function js(e){var t=al.current;ne(al),e._currentValue=t}function es(e,t,n){for(;e!==null;){var r=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,r!==null&&(r.childLanes|=t)):r!==null&&(r.childLanes&t)!==t&&(r.childLanes|=t),e===n)break;e=e.return}}function Hn(e,t){ul=e,Ds=jn=null,e=e.dependencies,e!==null&&e.firstContext!==null&&((e.lanes&t)!==0&&(ze=!0),e.firstContext=null)}function Je(e){var t=e._currentValue;if(Ds!==e)if(e={context:e,memoizedValue:t,next:null},jn===null){if(ul===null)throw Error(x(308));jn=e,ul.dependencies={lanes:0,firstContext:e}}else jn=jn.next=e;return t}var an=null;function Fs(e){an===null?an=[e]:an.push(e)}function gd(e,t,n,r){var o=t.interleaved;return o===null?(n.next=n,Fs(t)):(n.next=o.next,o.next=n),t.interleaved=n,It(e,r)}function It(e,t){e.lanes|=t;var n=e.alternate;for(n!==null&&(n.lanes|=t),n=e,e=e.return;e!==null;)e.childLanes|=t,n=e.alternate,n!==null&&(n.childLanes|=t),n=e,e=e.return;return n.tag===3?n.stateNode:null}var Ft=!1;function As(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,interleaved:null,lanes:0},effects:null}}function vd(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,effects:e.effects})}function bt(e,t){return{eventTime:e,lane:t,tag:0,payload:null,callback:null,next:null}}function Vt(e,t,n){var r=e.updateQueue;if(r===null)return null;if(r=r.shared,(B&2)!==0){var o=r.pending;return o===null?t.next=t:(t.next=o.next,o.next=t),r.pending=t,It(e,n)}return o=r.interleaved,o===null?(t.next=t,Fs(r)):(t.next=o.next,o.next=t),r.interleaved=t,It(e,n)}function Bo(e,t,n){if(t=t.updateQueue,t!==null&&(t=t.shared,(n&4194240)!==0)){var r=t.lanes;r&=e.pendingLanes,n|=r,t.lanes=n,Es(e,n)}}function Qu(e,t){var n=e.updateQueue,r=e.alternate;if(r!==null&&(r=r.updateQueue,n===r)){var o=null,l=null;if(n=n.firstBaseUpdate,n!==null){do{var i={eventTime:n.eventTime,lane:n.lane,tag:n.tag,payload:n.payload,callback:n.callback,next:null};l===null?o=l=i:l=l.next=i,n=n.next}while(n!==null);l===null?o=l=t:l=l.next=t}else o=l=t;n={baseState:r.baseState,firstBaseUpdate:o,lastBaseUpdate:l,shared:r.shared,effects:r.effects},e.updateQueue=n;return}e=n.lastBaseUpdate,e===null?n.firstBaseUpdate=t:e.next=t,n.lastBaseUpdate=t}function cl(e,t,n,r){var o=e.updateQueue;Ft=!1;var l=o.firstBaseUpdate,i=o.lastBaseUpdate,s=o.shared.pending;if(s!==null){o.shared.pending=null;var a=s,d=a.next;a.next=null,i===null?l=d:i.next=d,i=a;var g=e.alternate;g!==null&&(g=g.updateQueue,s=g.lastBaseUpdate,s!==i&&(s===null?g.firstBaseUpdate=d:s.next=d,g.lastBaseUpdate=a))}if(l!==null){var m=o.baseState;i=0,g=d=a=null,s=l;do{var h=s.lane,w=s.eventTime;if((r&h)===h){g!==null&&(g=g.next={eventTime:w,lane:0,tag:s.tag,payload:s.payload,callback:s.callback,next:null});e:{var C=e,L=s;switch(h=t,w=n,L.tag){case 1:if(C=L.payload,typeof C=="function"){m=C.call(w,m,h);break e}m=C;break e;case 3:C.flags=C.flags&-65537|128;case 0:if(C=L.payload,h=typeof C=="function"?C.call(w,m,h):C,h==null)break e;m=se({},m,h);break e;case 2:Ft=!0}}s.callback!==null&&s.lane!==0&&(e.flags|=64,h=o.effects,h===null?o.effects=[s]:h.push(s))}else w={eventTime:w,lane:h,tag:s.tag,payload:s.payload,callback:s.callback,next:null},g===null?(d=g=w,a=m):g=g.next=w,i|=h;if(s=s.next,s===null){if(s=o.shared.pending,s===null)break;h=s,s=h.next,h.next=null,o.lastBaseUpdate=h,o.shared.pending=null}}while(!0);if(g===null&&(a=m),o.baseState=a,o.firstBaseUpdate=d,o.lastBaseUpdate=g,t=o.shared.interleaved,t!==null){o=t;do i|=o.lane,o=o.next;while(o!==t)}else l===null&&(o.shared.lanes=0);mn|=i,e.lanes=i,e.memoizedState=m}}function Vu(e,t,n){if(e=t.effects,t.effects=null,e!==null)for(t=0;t<e.length;t++){var r=e[t],o=r.callback;if(o!==null){if(r.callback=null,r=n,typeof o!="function")throw Error(x(191,o));o.call(r)}}}var Gr={},vt=tn(Gr),Br=tn(Gr),Wr=tn(Gr);function un(e){if(e===Gr)throw Error(x(174));return e}function Ys(e,t){switch(G(Wr,t),G(Br,e),G(vt,Gr),e=t.nodeType,e){case 9:case 11:t=(t=t.documentElement)?t.namespaceURI:zi(null,"");break;default:e=e===8?t.parentNode:t,t=e.namespaceURI||null,e=e.tagName,t=zi(t,e)}ne(vt),G(vt,t)}function Gn(){ne(vt),ne(Br),ne(Wr)}function kd(e){un(Wr.current);var t=un(vt.current),n=zi(t,e.type);t!==n&&(G(Br,e),G(vt,n))}function Bs(e){Br.current===e&&(ne(vt),ne(Br))}var le=tn(0);function dl(e){for(var t=e;t!==null;){if(t.tag===13){var n=t.memoizedState;if(n!==null&&(n=n.dehydrated,n===null||n.data==="$?"||n.data==="$!"))return t}else if(t.tag===19&&t.memoizedProps.revealOrder!==void 0){if((t.flags&128)!==0)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var yi=[];function Ws(){for(var e=0;e<yi.length;e++)yi[e]._workInProgressVersionPrimary=null;yi.length=0}var Wo=zt.ReactCurrentDispatcher,gi=zt.ReactCurrentBatchConfig,pn=0,ie=null,pe=null,he=null,fl=!1,Pr=!1,Ur=0,U0=0;function we(){throw Error(x(321))}function Us(e,t){if(t===null)return!1;for(var n=0;n<t.length&&n<e.length;n++)if(!at(e[n],t[n]))return!1;return!0}function Hs(e,t,n,r,o,l){if(pn=l,ie=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,Wo.current=e===null||e.memoizedState===null?V0:Z0,e=n(r,o),Pr){l=0;do{if(Pr=!1,Ur=0,25<=l)throw Error(x(301));l+=1,he=pe=null,t.updateQueue=null,Wo.current=K0,e=n(r,o)}while(Pr)}if(Wo.current=_l,t=pe!==null&&pe.next!==null,pn=0,he=pe=ie=null,fl=!1,t)throw Error(x(300));return e}function Xs(){var e=Ur!==0;return Ur=0,e}function ht(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return he===null?ie.memoizedState=he=e:he=he.next=e,he}function qe(){if(pe===null){var e=ie.alternate;e=e!==null?e.memoizedState:null}else e=pe.next;var t=he===null?ie.memoizedState:he.next;if(t!==null)he=t,pe=e;else{if(e===null)throw Error(x(310));pe=e,e={memoizedState:pe.memoizedState,baseState:pe.baseState,baseQueue:pe.baseQueue,queue:pe.queue,next:null},he===null?ie.memoizedState=he=e:he=he.next=e}return he}function Hr(e,t){return typeof t=="function"?t(e):t}function vi(e){var t=qe(),n=t.queue;if(n===null)throw Error(x(311));n.lastRenderedReducer=e;var r=pe,o=r.baseQueue,l=n.pending;if(l!==null){if(o!==null){var i=o.next;o.next=l.next,l.next=i}r.baseQueue=o=l,n.pending=null}if(o!==null){l=o.next,r=r.baseState;var s=i=null,a=null,d=l;do{var g=d.lane;if((pn&g)===g)a!==null&&(a=a.next={lane:0,action:d.action,hasEagerState:d.hasEagerState,eagerState:d.eagerState,next:null}),r=d.hasEagerState?d.eagerState:e(r,d.action);else{var m={lane:g,action:d.action,hasEagerState:d.hasEagerState,eagerState:d.eagerState,next:null};a===null?(s=a=m,i=r):a=a.next=m,ie.lanes|=g,mn|=g}d=d.next}while(d!==null&&d!==l);a===null?i=r:a.next=s,at(r,t.memoizedState)||(ze=!0),t.memoizedState=r,t.baseState=i,t.baseQueue=a,n.lastRenderedState=r}if(e=n.interleaved,e!==null){o=e;do l=o.lane,ie.lanes|=l,mn|=l,o=o.next;while(o!==e)}else o===null&&(n.lanes=0);return[t.memoizedState,n.dispatch]}function ki(e){var t=qe(),n=t.queue;if(n===null)throw Error(x(311));n.lastRenderedReducer=e;var r=n.dispatch,o=n.pending,l=t.memoizedState;if(o!==null){n.pending=null;var i=o=o.next;do l=e(l,i.action),i=i.next;while(i!==o);at(l,t.memoizedState)||(ze=!0),t.memoizedState=l,t.baseQueue===null&&(t.baseState=l),n.lastRenderedState=l}return[l,r]}function xd(){}function wd(e,t){var n=ie,r=qe(),o=t(),l=!at(r.memoizedState,o);if(l&&(r.memoizedState=o,ze=!0),r=r.queue,Qs(Ed.bind(null,n,r,e),[e]),r.getSnapshot!==t||l||he!==null&&he.memoizedState.tag&1){if(n.flags|=2048,Xr(9,Sd.bind(null,n,r,o,t),void 0,null),ye===null)throw Error(x(349));(pn&30)!==0||Cd(n,t,o)}return o}function Cd(e,t,n){e.flags|=16384,e={getSnapshot:t,value:n},t=ie.updateQueue,t===null?(t={lastEffect:null,stores:null},ie.updateQueue=t,t.stores=[e]):(n=t.stores,n===null?t.stores=[e]:n.push(e))}function Sd(e,t,n,r){t.value=n,t.getSnapshot=r,Ld(t)&&Pd(e)}function Ed(e,t,n){return n(function(){Ld(t)&&Pd(e)})}function Ld(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!at(e,n)}catch{return!0}}function Pd(e){var t=It(e,1);t!==null&&st(t,e,1,-1)}function Zu(e){var t=ht();return typeof e=="function"&&(e=e()),t.memoizedState=t.baseState=e,e={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:Hr,lastRenderedState:e},t.queue=e,e=e.dispatch=Q0.bind(null,ie,e),[t.memoizedState,e]}function Xr(e,t,n,r){return e={tag:e,create:t,destroy:n,deps:r,next:null},t=ie.updateQueue,t===null?(t={lastEffect:null,stores:null},ie.updateQueue=t,t.lastEffect=e.next=e):(n=t.lastEffect,n===null?t.lastEffect=e.next=e:(r=n.next,n.next=e,e.next=r,t.lastEffect=e)),e}function Nd(){return qe().memoizedState}function Uo(e,t,n,r){var o=ht();ie.flags|=e,o.memoizedState=Xr(1|t,n,void 0,r===void 0?null:r)}function El(e,t,n,r){var o=qe();r=r===void 0?null:r;var l=void 0;if(pe!==null){var i=pe.memoizedState;if(l=i.destroy,r!==null&&Us(r,i.deps)){o.memoizedState=Xr(t,n,l,r);return}}ie.flags|=e,o.memoizedState=Xr(1|t,n,l,r)}function Ku(e,t){return Uo(8390656,8,e,t)}function Qs(e,t){return El(2048,8,e,t)}function bd(e,t){return El(4,2,e,t)}function Md(e,t){return El(4,4,e,t)}function Td(e,t){if(typeof t=="function")return e=e(),t(e),function(){t(null)};if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function Id(e,t,n){return n=n!=null?n.concat([e]):null,El(4,4,Td.bind(null,t,e),n)}function Vs(){}function Od(e,t){var n=qe();t=t===void 0?null:t;var r=n.memoizedState;return r!==null&&t!==null&&Us(t,r[1])?r[0]:(n.memoizedState=[e,t],e)}function zd(e,t){var n=qe();t=t===void 0?null:t;var r=n.memoizedState;return r!==null&&t!==null&&Us(t,r[1])?r[0]:(e=e(),n.memoizedState=[e,t],e)}function $d(e,t,n){return(pn&21)===0?(e.baseState&&(e.baseState=!1,ze=!0),e.memoizedState=n):(at(n,t)||(n=Ac(),ie.lanes|=n,mn|=n,e.baseState=!0),t)}function H0(e,t){var n=Q;Q=n!==0&&4>n?n:4,e(!0);var r=gi.transition;gi.transition={};try{e(!1),t()}finally{Q=n,gi.transition=r}}function Dd(){return qe().memoizedState}function X0(e,t,n){var r=Kt(e);if(n={lane:r,action:n,hasEagerState:!1,eagerState:null,next:null},Rd(e))jd(t,n);else if(n=gd(e,t,n,r),n!==null){var o=Me();st(n,e,r,o),Fd(n,t,r)}}function Q0(e,t,n){var r=Kt(e),o={lane:r,action:n,hasEagerState:!1,eagerState:null,next:null};if(Rd(e))jd(t,o);else{var l=e.alternate;if(e.lanes===0&&(l===null||l.lanes===0)&&(l=t.lastRenderedReducer,l!==null))try{var i=t.lastRenderedState,s=l(i,n);if(o.hasEagerState=!0,o.eagerState=s,at(s,i)){var a=t.interleaved;a===null?(o.next=o,Fs(t)):(o.next=a.next,a.next=o),t.interleaved=o;return}}catch{}finally{}n=gd(e,t,o,r),n!==null&&(o=Me(),st(n,e,r,o),Fd(n,t,r))}}function Rd(e){var t=e.alternate;return e===ie||t!==null&&t===ie}function jd(e,t){Pr=fl=!0;var n=e.pending;n===null?t.next=t:(t.next=n.next,n.next=t),e.pending=t}function Fd(e,t,n){if((n&4194240)!==0){var r=t.lanes;r&=e.pendingLanes,n|=r,t.lanes=n,Es(e,n)}}var _l={readContext:Je,useCallback:we,useContext:we,useEffect:we,useImperativeHandle:we,useInsertionEffect:we,useLayoutEffect:we,useMemo:we,useReducer:we,useRef:we,useState:we,useDebugValue:we,useDeferredValue:we,useTransition:we,useMutableSource:we,useSyncExternalStore:we,useId:we,unstable_isNewReconciler:!1},V0={readContext:Je,useCallback:function(e,t){return ht().memoizedState=[e,t===void 0?null:t],e},useContext:Je,useEffect:Ku,useImperativeHandle:function(e,t,n){return n=n!=null?n.concat([e]):null,Uo(4194308,4,Td.bind(null,t,e),n)},useLayoutEffect:function(e,t){return Uo(4194308,4,e,t)},useInsertionEffect:function(e,t){return Uo(4,2,e,t)},useMemo:function(e,t){var n=ht();return t=t===void 0?null:t,e=e(),n.memoizedState=[e,t],e},useReducer:function(e,t,n){var r=ht();return t=n!==void 0?n(t):t,r.memoizedState=r.baseState=t,e={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:t},r.queue=e,e=e.dispatch=X0.bind(null,ie,e),[r.memoizedState,e]},useRef:function(e){var t=ht();return e={current:e},t.memoizedState=e},useState:Zu,useDebugValue:Vs,useDeferredValue:function(e){return ht().memoizedState=e},useTransition:function(){var e=Zu(!1),t=e[0];return e=H0.bind(null,e[1]),ht().memoizedState=e,[t,e]},useMutableSource:function(){},useSyncExternalStore:function(e,t,n){var r=ie,o=ht();if(oe){if(n===void 0)throw Error(x(407));n=n()}else{if(n=t(),ye===null)throw Error(x(349));(pn&30)!==0||Cd(r,t,n)}o.memoizedState=n;var l={value:n,getSnapshot:t};return o.queue=l,Ku(Ed.bind(null,r,l,e),[e]),r.flags|=2048,Xr(9,Sd.bind(null,r,l,n,t),void 0,null),n},useId:function(){var e=ht(),t=ye.identifierPrefix;if(oe){var n=Nt,r=Pt;n=(r&~(1<<32-it(r)-1)).toString(32)+n,t=":"+t+"R"+n,n=Ur++,0<n&&(t+="H"+n.toString(32)),t+=":"}else n=U0++,t=":"+t+"r"+n.toString(32)+":";return e.memoizedState=t},unstable_isNewReconciler:!1},Z0={readContext:Je,useCallback:Od,useContext:Je,useEffect:Qs,useImperativeHandle:Id,useInsertionEffect:bd,useLayoutEffect:Md,useMemo:zd,useReducer:vi,useRef:Nd,useState:function(){return vi(Hr)},useDebugValue:Vs,useDeferredValue:function(e){var t=qe();return $d(t,pe.memoizedState,e)},useTransition:function(){var e=vi(Hr)[0],t=qe().memoizedState;return[e,t]},useMutableSource:xd,useSyncExternalStore:wd,useId:Dd,unstable_isNewReconciler:!1},K0={readContext:Je,useCallback:Od,useContext:Je,useEffect:Qs,useImperativeHandle:Id,useInsertionEffect:bd,useLayoutEffect:Md,useMemo:zd,useReducer:ki,useRef:Nd,useState:function(){return ki(Hr)},useDebugValue:Vs,useDeferredValue:function(e){var t=qe();return pe===null?t.memoizedState=e:$d(t,pe.memoizedState,e)},useTransition:function(){var e=ki(Hr)[0],t=qe().memoizedState;return[e,t]},useMutableSource:xd,useSyncExternalStore:wd,useId:Dd,unstable_isNewReconciler:!1};function rt(e,t){if(e&&e.defaultProps){t=se({},t),e=e.defaultProps;for(var n in e)t[n]===void 0&&(t[n]=e[n]);return t}return t}function ts(e,t,n,r){t=e.memoizedState,n=n(r,t),n=n==null?t:se({},t,n),e.memoizedState=n,e.lanes===0&&(e.updateQueue.baseState=n)}var Ll={isMounted:function(e){return(e=e._reactInternals)?gn(e)===e:!1},enqueueSetState:function(e,t,n){e=e._reactInternals;var r=Me(),o=Kt(e),l=bt(r,o);l.payload=t,n!=null&&(l.callback=n),t=Vt(e,l,o),t!==null&&(st(t,e,o,r),Bo(t,e,o))},enqueueReplaceState:function(e,t,n){e=e._reactInternals;var r=Me(),o=Kt(e),l=bt(r,o);l.tag=1,l.payload=t,n!=null&&(l.callback=n),t=Vt(e,l,o),t!==null&&(st(t,e,o,r),Bo(t,e,o))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var n=Me(),r=Kt(e),o=bt(n,r);o.tag=2,t!=null&&(o.callback=t),t=Vt(e,o,r),t!==null&&(st(t,e,r,n),Bo(t,e,r))}};function Gu(e,t,n,r,o,l,i){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(r,l,i):t.prototype&&t.prototype.isPureReactComponent?!jr(n,r)||!jr(o,l):!0}function Ad(e,t,n){var r=!1,o=qt,l=t.contextType;return typeof l=="object"&&l!==null?l=Je(l):(o=De(t)?fn:Ee.current,r=t.contextTypes,l=(r=r!=null)?Vn(e,o):qt),t=new t(n,l),e.memoizedState=t.state!==null&&t.state!==void 0?t.state:null,t.updater=Ll,e.stateNode=t,t._reactInternals=e,r&&(e=e.stateNode,e.__reactInternalMemoizedUnmaskedChildContext=o,e.__reactInternalMemoizedMaskedChildContext=l),t}function Ju(e,t,n,r){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(n,r),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(n,r),t.state!==e&&Ll.enqueueReplaceState(t,t.state,null)}function ns(e,t,n,r){var o=e.stateNode;o.props=n,o.state=e.memoizedState,o.refs={},As(e);var l=t.contextType;typeof l=="object"&&l!==null?o.context=Je(l):(l=De(t)?fn:Ee.current,o.context=Vn(e,l)),o.state=e.memoizedState,l=t.getDerivedStateFromProps,typeof l=="function"&&(ts(e,t,l,n),o.state=e.memoizedState),typeof t.getDerivedStateFromProps=="function"||typeof o.getSnapshotBeforeUpdate=="function"||typeof o.UNSAFE_componentWillMount!="function"&&typeof o.componentWillMount!="function"||(t=o.state,typeof o.componentWillMount=="function"&&o.componentWillMount(),typeof o.UNSAFE_componentWillMount=="function"&&o.UNSAFE_componentWillMount(),t!==o.state&&Ll.enqueueReplaceState(o,o.state,null),cl(e,n,o,r),o.state=e.memoizedState),typeof o.componentDidMount=="function"&&(e.flags|=4194308)}function Jn(e,t){try{var n="",r=t;do n+=L1(r),r=r.return;while(r);var o=n}catch(l){o=`
Error generating stack: `+l.message+`
`+l.stack}return{value:e,source:t,stack:o,digest:null}}function xi(e,t,n){return{value:e,source:null,stack:n??null,digest:t??null}}function rs(e,t){try{console.error(t.value)}catch(n){setTimeout(function(){throw n})}}var G0=typeof WeakMap=="function"?WeakMap:Map;function Yd(e,t,n){n=bt(-1,n),n.tag=3,n.payload={element:null};var r=t.value;return n.callback=function(){ml||(ml=!0,_s=r),rs(e,t)},n}function Bd(e,t,n){n=bt(-1,n),n.tag=3;var r=e.type.getDerivedStateFromError;if(typeof r=="function"){var o=t.value;n.payload=function(){return r(o)},n.callback=function(){rs(e,t)}}var l=e.stateNode;return l!==null&&typeof l.componentDidCatch=="function"&&(n.callback=function(){rs(e,t),typeof r!="function"&&(Zt===null?Zt=new Set([this]):Zt.add(this));var i=t.stack;this.componentDidCatch(t.value,{componentStack:i!==null?i:""})}),n}function qu(e,t,n){var r=e.pingCache;if(r===null){r=e.pingCache=new G0;var o=new Set;r.set(t,o)}else o=r.get(t),o===void 0&&(o=new Set,r.set(t,o));o.has(n)||(o.add(n),e=d_.bind(null,e,t,n),t.then(e,e))}function ec(e){do{var t;if((t=e.tag===13)&&(t=e.memoizedState,t=t!==null?t.dehydrated!==null:!0),t)return e;e=e.return}while(e!==null);return null}function tc(e,t,n,r,o){return(e.mode&1)===0?(e===t?e.flags|=65536:(e.flags|=128,n.flags|=131072,n.flags&=-52805,n.tag===1&&(n.alternate===null?n.tag=17:(t=bt(-1,1),t.tag=2,Vt(n,t,1))),n.lanes|=1),e):(e.flags|=65536,e.lanes=o,e)}var J0=zt.ReactCurrentOwner,ze=!1;function be(e,t,n,r){t.child=e===null?yd(t,null,n,r):Kn(t,e.child,n,r)}function nc(e,t,n,r,o){n=n.render;var l=t.ref;return Hn(t,o),r=Hs(e,t,n,r,l,o),n=Xs(),e!==null&&!ze?(t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~o,Ot(e,t,o)):(oe&&n&&Os(t),t.flags|=1,be(e,t,r,o),t.child)}function rc(e,t,n,r,o){if(e===null){var l=n.type;return typeof l=="function"&&!na(l)&&l.defaultProps===void 0&&n.compare===null&&n.defaultProps===void 0?(t.tag=15,t.type=l,Wd(e,t,l,r,o)):(e=Vo(n.type,null,r,t,t.mode,o),e.ref=t.ref,e.return=t,t.child=e)}if(l=e.child,(e.lanes&o)===0){var i=l.memoizedProps;if(n=n.compare,n=n!==null?n:jr,n(i,r)&&e.ref===t.ref)return Ot(e,t,o)}return t.flags|=1,e=Gt(l,r),e.ref=t.ref,e.return=t,t.child=e}function Wd(e,t,n,r,o){if(e!==null){var l=e.memoizedProps;if(jr(l,r)&&e.ref===t.ref)if(ze=!1,t.pendingProps=r=l,(e.lanes&o)!==0)(e.flags&131072)!==0&&(ze=!0);else return t.lanes=e.lanes,Ot(e,t,o)}return os(e,t,n,r,o)}function Ud(e,t,n){var r=t.pendingProps,o=r.children,l=e!==null?e.memoizedState:null;if(r.mode==="hidden")if((t.mode&1)===0)t.memoizedState={baseLanes:0,cachePool:null,transitions:null},G(An,Ae),Ae|=n;else{if((n&1073741824)===0)return e=l!==null?l.baseLanes|n:n,t.lanes=t.childLanes=1073741824,t.memoizedState={baseLanes:e,cachePool:null,transitions:null},t.updateQueue=null,G(An,Ae),Ae|=e,null;t.memoizedState={baseLanes:0,cachePool:null,transitions:null},r=l!==null?l.baseLanes:n,G(An,Ae),Ae|=r}else l!==null?(r=l.baseLanes|n,t.memoizedState=null):r=n,G(An,Ae),Ae|=r;return be(e,t,o,n),t.child}function Hd(e,t){var n=t.ref;(e===null&&n!==null||e!==null&&e.ref!==n)&&(t.flags|=512,t.flags|=2097152)}function os(e,t,n,r,o){var l=De(n)?fn:Ee.current;return l=Vn(t,l),Hn(t,o),n=Hs(e,t,n,r,l,o),r=Xs(),e!==null&&!ze?(t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~o,Ot(e,t,o)):(oe&&r&&Os(t),t.flags|=1,be(e,t,n,o),t.child)}function oc(e,t,n,r,o){if(De(n)){var l=!0;ll(t)}else l=!1;if(Hn(t,o),t.stateNode===null)Ho(e,t),Ad(t,n,r),ns(t,n,r,o),r=!0;else if(e===null){var i=t.stateNode,s=t.memoizedProps;i.props=s;var a=i.context,d=n.contextType;typeof d=="object"&&d!==null?d=Je(d):(d=De(n)?fn:Ee.current,d=Vn(t,d));var g=n.getDerivedStateFromProps,m=typeof g=="function"||typeof i.getSnapshotBeforeUpdate=="function";m||typeof i.UNSAFE_componentWillReceiveProps!="function"&&typeof i.componentWillReceiveProps!="function"||(s!==r||a!==d)&&Ju(t,i,r,d),Ft=!1;var h=t.memoizedState;i.state=h,cl(t,r,i,o),a=t.memoizedState,s!==r||h!==a||$e.current||Ft?(typeof g=="function"&&(ts(t,n,g,r),a=t.memoizedState),(s=Ft||Gu(t,n,s,r,h,a,d))?(m||typeof i.UNSAFE_componentWillMount!="function"&&typeof i.componentWillMount!="function"||(typeof i.componentWillMount=="function"&&i.componentWillMount(),typeof i.UNSAFE_componentWillMount=="function"&&i.UNSAFE_componentWillMount()),typeof i.componentDidMount=="function"&&(t.flags|=4194308)):(typeof i.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=r,t.memoizedState=a),i.props=r,i.state=a,i.context=d,r=s):(typeof i.componentDidMount=="function"&&(t.flags|=4194308),r=!1)}else{i=t.stateNode,vd(e,t),s=t.memoizedProps,d=t.type===t.elementType?s:rt(t.type,s),i.props=d,m=t.pendingProps,h=i.context,a=n.contextType,typeof a=="object"&&a!==null?a=Je(a):(a=De(n)?fn:Ee.current,a=Vn(t,a));var w=n.getDerivedStateFromProps;(g=typeof w=="function"||typeof i.getSnapshotBeforeUpdate=="function")||typeof i.UNSAFE_componentWillReceiveProps!="function"&&typeof i.componentWillReceiveProps!="function"||(s!==m||h!==a)&&Ju(t,i,r,a),Ft=!1,h=t.memoizedState,i.state=h,cl(t,r,i,o);var C=t.memoizedState;s!==m||h!==C||$e.current||Ft?(typeof w=="function"&&(ts(t,n,w,r),C=t.memoizedState),(d=Ft||Gu(t,n,d,r,h,C,a)||!1)?(g||typeof i.UNSAFE_componentWillUpdate!="function"&&typeof i.componentWillUpdate!="function"||(typeof i.componentWillUpdate=="function"&&i.componentWillUpdate(r,C,a),typeof i.UNSAFE_componentWillUpdate=="function"&&i.UNSAFE_componentWillUpdate(r,C,a)),typeof i.componentDidUpdate=="function"&&(t.flags|=4),typeof i.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof i.componentDidUpdate!="function"||s===e.memoizedProps&&h===e.memoizedState||(t.flags|=4),typeof i.getSnapshotBeforeUpdate!="function"||s===e.memoizedProps&&h===e.memoizedState||(t.flags|=1024),t.memoizedProps=r,t.memoizedState=C),i.props=r,i.state=C,i.context=a,r=d):(typeof i.componentDidUpdate!="function"||s===e.memoizedProps&&h===e.memoizedState||(t.flags|=4),typeof i.getSnapshotBeforeUpdate!="function"||s===e.memoizedProps&&h===e.memoizedState||(t.flags|=1024),r=!1)}return ls(e,t,n,r,l,o)}function ls(e,t,n,r,o,l){Hd(e,t);var i=(t.flags&128)!==0;if(!r&&!i)return o&&Wu(t,n,!1),Ot(e,t,l);r=t.stateNode,J0.current=t;var s=i&&typeof n.getDerivedStateFromError!="function"?null:r.render();return t.flags|=1,e!==null&&i?(t.child=Kn(t,e.child,null,l),t.child=Kn(t,null,s,l)):be(e,t,s,l),t.memoizedState=r.state,o&&Wu(t,n,!0),t.child}function Xd(e){var t=e.stateNode;t.pendingContext?Bu(e,t.pendingContext,t.pendingContext!==t.context):t.context&&Bu(e,t.context,!1),Ys(e,t.containerInfo)}function lc(e,t,n,r,o){return Zn(),$s(o),t.flags|=256,be(e,t,n,r),t.child}var is={dehydrated:null,treeContext:null,retryLane:0};function ss(e){return{baseLanes:e,cachePool:null,transitions:null}}function Qd(e,t,n){var r=t.pendingProps,o=le.current,l=!1,i=(t.flags&128)!==0,s;if((s=i)||(s=e!==null&&e.memoizedState===null?!1:(o&2)!==0),s?(l=!0,t.flags&=-129):(e===null||e.memoizedState!==null)&&(o|=1),G(le,o&1),e===null)return qi(t),e=t.memoizedState,e!==null&&(e=e.dehydrated,e!==null)?((t.mode&1)===0?t.lanes=1:e.data==="$!"?t.lanes=8:t.lanes=1073741824,null):(i=r.children,e=r.fallback,l?(r=t.mode,l=t.child,i={mode:"hidden",children:i},(r&1)===0&&l!==null?(l.childLanes=0,l.pendingProps=i):l=bl(i,r,0,null),e=dn(e,r,n,null),l.return=t,e.return=t,l.sibling=e,t.child=l,t.child.memoizedState=ss(n),t.memoizedState=is,e):Zs(t,i));if(o=e.memoizedState,o!==null&&(s=o.dehydrated,s!==null))return q0(e,t,i,r,s,o,n);if(l){l=r.fallback,i=t.mode,o=e.child,s=o.sibling;var a={mode:"hidden",children:r.children};return(i&1)===0&&t.child!==o?(r=t.child,r.childLanes=0,r.pendingProps=a,t.deletions=null):(r=Gt(o,a),r.subtreeFlags=o.subtreeFlags&14680064),s!==null?l=Gt(s,l):(l=dn(l,i,n,null),l.flags|=2),l.return=t,r.return=t,r.sibling=l,t.child=r,r=l,l=t.child,i=e.child.memoizedState,i=i===null?ss(n):{baseLanes:i.baseLanes|n,cachePool:null,transitions:i.transitions},l.memoizedState=i,l.childLanes=e.childLanes&~n,t.memoizedState=is,r}return l=e.child,e=l.sibling,r=Gt(l,{mode:"visible",children:r.children}),(t.mode&1)===0&&(r.lanes=n),r.return=t,r.sibling=null,e!==null&&(n=t.deletions,n===null?(t.deletions=[e],t.flags|=16):n.push(e)),t.child=r,t.memoizedState=null,r}function Zs(e,t){return t=bl({mode:"visible",children:t},e.mode,0,null),t.return=e,e.child=t}function Do(e,t,n,r){return r!==null&&$s(r),Kn(t,e.child,null,n),e=Zs(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function q0(e,t,n,r,o,l,i){if(n)return t.flags&256?(t.flags&=-257,r=xi(Error(x(422))),Do(e,t,i,r)):t.memoizedState!==null?(t.child=e.child,t.flags|=128,null):(l=r.fallback,o=t.mode,r=bl({mode:"visible",children:r.children},o,0,null),l=dn(l,o,i,null),l.flags|=2,r.return=t,l.return=t,r.sibling=l,t.child=r,(t.mode&1)!==0&&Kn(t,e.child,null,i),t.child.memoizedState=ss(i),t.memoizedState=is,l);if((t.mode&1)===0)return Do(e,t,i,null);if(o.data==="$!"){if(r=o.nextSibling&&o.nextSibling.dataset,r)var s=r.dgst;return r=s,l=Error(x(419)),r=xi(l,r,void 0),Do(e,t,i,r)}if(s=(i&e.childLanes)!==0,ze||s){if(r=ye,r!==null){switch(i&-i){case 4:o=2;break;case 16:o=8;break;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:o=32;break;case 536870912:o=268435456;break;default:o=0}o=(o&(r.suspendedLanes|i))!==0?0:o,o!==0&&o!==l.retryLane&&(l.retryLane=o,It(e,o),st(r,e,o,-1))}return ta(),r=xi(Error(x(421))),Do(e,t,i,r)}return o.data==="$?"?(t.flags|=128,t.child=e.child,t=f_.bind(null,e),o._reactRetry=t,null):(e=l.treeContext,Ye=Qt(o.nextSibling),Be=t,oe=!0,lt=null,e!==null&&(Ve[Ze++]=Pt,Ve[Ze++]=Nt,Ve[Ze++]=_n,Pt=e.id,Nt=e.overflow,_n=t),t=Zs(t,r.children),t.flags|=4096,t)}function ic(e,t,n){e.lanes|=t;var r=e.alternate;r!==null&&(r.lanes|=t),es(e.return,t,n)}function wi(e,t,n,r,o){var l=e.memoizedState;l===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:r,tail:n,tailMode:o}:(l.isBackwards=t,l.rendering=null,l.renderingStartTime=0,l.last=r,l.tail=n,l.tailMode=o)}function Vd(e,t,n){var r=t.pendingProps,o=r.revealOrder,l=r.tail;if(be(e,t,r.children,n),r=le.current,(r&2)!==0)r=r&1|2,t.flags|=128;else{if(e!==null&&(e.flags&128)!==0)e:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&ic(e,n,t);else if(e.tag===19)ic(e,n,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break e;for(;e.sibling===null;){if(e.return===null||e.return===t)break e;e=e.return}e.sibling.return=e.return,e=e.sibling}r&=1}if(G(le,r),(t.mode&1)===0)t.memoizedState=null;else switch(o){case"forwards":for(n=t.child,o=null;n!==null;)e=n.alternate,e!==null&&dl(e)===null&&(o=n),n=n.sibling;n=o,n===null?(o=t.child,t.child=null):(o=n.sibling,n.sibling=null),wi(t,!1,o,n,l);break;case"backwards":for(n=null,o=t.child,t.child=null;o!==null;){if(e=o.alternate,e!==null&&dl(e)===null){t.child=o;break}e=o.sibling,o.sibling=n,n=o,o=e}wi(t,!0,n,null,l);break;case"together":wi(t,!1,null,null,void 0);break;default:t.memoizedState=null}return t.child}function Ho(e,t){(t.mode&1)===0&&e!==null&&(e.alternate=null,t.alternate=null,t.flags|=2)}function Ot(e,t,n){if(e!==null&&(t.dependencies=e.dependencies),mn|=t.lanes,(n&t.childLanes)===0)return null;if(e!==null&&t.child!==e.child)throw Error(x(153));if(t.child!==null){for(e=t.child,n=Gt(e,e.pendingProps),t.child=n,n.return=t;e.sibling!==null;)e=e.sibling,n=n.sibling=Gt(e,e.pendingProps),n.return=t;n.sibling=null}return t.child}function e_(e,t,n){switch(t.tag){case 3:Xd(t),Zn();break;case 5:kd(t);break;case 1:De(t.type)&&ll(t);break;case 4:Ys(t,t.stateNode.containerInfo);break;case 10:var r=t.type._context,o=t.memoizedProps.value;G(al,r._currentValue),r._currentValue=o;break;case 13:if(r=t.memoizedState,r!==null)return r.dehydrated!==null?(G(le,le.current&1),t.flags|=128,null):(n&t.child.childLanes)!==0?Qd(e,t,n):(G(le,le.current&1),e=Ot(e,t,n),e!==null?e.sibling:null);G(le,le.current&1);break;case 19:if(r=(n&t.childLanes)!==0,(e.flags&128)!==0){if(r)return Vd(e,t,n);t.flags|=128}if(o=t.memoizedState,o!==null&&(o.rendering=null,o.tail=null,o.lastEffect=null),G(le,le.current),r)break;return null;case 22:case 23:return t.lanes=0,Ud(e,t,n)}return Ot(e,t,n)}var Zd,as,Kd,Gd;Zd=function(e,t){for(var n=t.child;n!==null;){if(n.tag===5||n.tag===6)e.appendChild(n.stateNode);else if(n.tag!==4&&n.child!==null){n.child.return=n,n=n.child;continue}if(n===t)break;for(;n.sibling===null;){if(n.return===null||n.return===t)return;n=n.return}n.sibling.return=n.return,n=n.sibling}};as=function(){};Kd=function(e,t,n,r){var o=e.memoizedProps;if(o!==r){e=t.stateNode,un(vt.current);var l=null;switch(n){case"input":o=Mi(e,o),r=Mi(e,r),l=[];break;case"select":o=se({},o,{value:void 0}),r=se({},r,{value:void 0}),l=[];break;case"textarea":o=Oi(e,o),r=Oi(e,r),l=[];break;default:typeof o.onClick!="function"&&typeof r.onClick=="function"&&(e.onclick=rl)}$i(n,r);var i;n=null;for(d in o)if(!r.hasOwnProperty(d)&&o.hasOwnProperty(d)&&o[d]!=null)if(d==="style"){var s=o[d];for(i in s)s.hasOwnProperty(i)&&(n||(n={}),n[i]="")}else d!=="dangerouslySetInnerHTML"&&d!=="children"&&d!=="suppressContentEditableWarning"&&d!=="suppressHydrationWarning"&&d!=="autoFocus"&&(Tr.hasOwnProperty(d)?l||(l=[]):(l=l||[]).push(d,null));for(d in r){var a=r[d];if(s=o?.[d],r.hasOwnProperty(d)&&a!==s&&(a!=null||s!=null))if(d==="style")if(s){for(i in s)!s.hasOwnProperty(i)||a&&a.hasOwnProperty(i)||(n||(n={}),n[i]="");for(i in a)a.hasOwnProperty(i)&&s[i]!==a[i]&&(n||(n={}),n[i]=a[i])}else n||(l||(l=[]),l.push(d,n)),n=a;else d==="dangerouslySetInnerHTML"?(a=a?a.__html:void 0,s=s?s.__html:void 0,a!=null&&s!==a&&(l=l||[]).push(d,a)):d==="children"?typeof a!="string"&&typeof a!="number"||(l=l||[]).push(d,""+a):d!=="suppressContentEditableWarning"&&d!=="suppressHydrationWarning"&&(Tr.hasOwnProperty(d)?(a!=null&&d==="onScroll"&&te("scroll",e),l||s===a||(l=[])):(l=l||[]).push(d,a))}n&&(l=l||[]).push("style",n);var d=l;(t.updateQueue=d)&&(t.flags|=4)}};Gd=function(e,t,n,r){n!==r&&(t.flags|=4)};function mr(e,t){if(!oe)switch(e.tailMode){case"hidden":t=e.tail;for(var n=null;t!==null;)t.alternate!==null&&(n=t),t=t.sibling;n===null?e.tail=null:n.sibling=null;break;case"collapsed":n=e.tail;for(var r=null;n!==null;)n.alternate!==null&&(r=n),n=n.sibling;r===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:r.sibling=null}}function Ce(e){var t=e.alternate!==null&&e.alternate.child===e.child,n=0,r=0;if(t)for(var o=e.child;o!==null;)n|=o.lanes|o.childLanes,r|=o.subtreeFlags&14680064,r|=o.flags&14680064,o.return=e,o=o.sibling;else for(o=e.child;o!==null;)n|=o.lanes|o.childLanes,r|=o.subtreeFlags,r|=o.flags,o.return=e,o=o.sibling;return e.subtreeFlags|=r,e.childLanes=n,t}function t_(e,t,n){var r=t.pendingProps;switch(zs(t),t.tag){case 2:case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return Ce(t),null;case 1:return De(t.type)&&ol(),Ce(t),null;case 3:return r=t.stateNode,Gn(),ne($e),ne(Ee),Ws(),r.pendingContext&&(r.context=r.pendingContext,r.pendingContext=null),(e===null||e.child===null)&&(zo(t)?t.flags|=4:e===null||e.memoizedState.isDehydrated&&(t.flags&256)===0||(t.flags|=1024,lt!==null&&(hs(lt),lt=null))),as(e,t),Ce(t),null;case 5:Bs(t);var o=un(Wr.current);if(n=t.type,e!==null&&t.stateNode!=null)Kd(e,t,n,r,o),e.ref!==t.ref&&(t.flags|=512,t.flags|=2097152);else{if(!r){if(t.stateNode===null)throw Error(x(166));return Ce(t),null}if(e=un(vt.current),zo(t)){r=t.stateNode,n=t.type;var l=t.memoizedProps;switch(r[yt]=t,r[Yr]=l,e=(t.mode&1)!==0,n){case"dialog":te("cancel",r),te("close",r);break;case"iframe":case"object":case"embed":te("load",r);break;case"video":case"audio":for(o=0;o<xr.length;o++)te(xr[o],r);break;case"source":te("error",r);break;case"img":case"image":case"link":te("error",r),te("load",r);break;case"details":te("toggle",r);break;case"input":pu(r,l),te("invalid",r);break;case"select":r._wrapperState={wasMultiple:!!l.multiple},te("invalid",r);break;case"textarea":hu(r,l),te("invalid",r)}$i(n,l),o=null;for(var i in l)if(l.hasOwnProperty(i)){var s=l[i];i==="children"?typeof s=="string"?r.textContent!==s&&(l.suppressHydrationWarning!==!0&&Oo(r.textContent,s,e),o=["children",s]):typeof s=="number"&&r.textContent!==""+s&&(l.suppressHydrationWarning!==!0&&Oo(r.textContent,s,e),o=["children",""+s]):Tr.hasOwnProperty(i)&&s!=null&&i==="onScroll"&&te("scroll",r)}switch(n){case"input":xo(r),mu(r,l,!0);break;case"textarea":xo(r),yu(r);break;case"select":case"option":break;default:typeof l.onClick=="function"&&(r.onclick=rl)}r=o,t.updateQueue=r,r!==null&&(t.flags|=4)}else{i=o.nodeType===9?o:o.ownerDocument,e==="http://www.w3.org/1999/xhtml"&&(e=Ec(n)),e==="http://www.w3.org/1999/xhtml"?n==="script"?(e=i.createElement("div"),e.innerHTML="<script><\/script>",e=e.removeChild(e.firstChild)):typeof r.is=="string"?e=i.createElement(n,{is:r.is}):(e=i.createElement(n),n==="select"&&(i=e,r.multiple?i.multiple=!0:r.size&&(i.size=r.size))):e=i.createElementNS(e,n),e[yt]=t,e[Yr]=r,Zd(e,t,!1,!1),t.stateNode=e;e:{switch(i=Di(n,r),n){case"dialog":te("cancel",e),te("close",e),o=r;break;case"iframe":case"object":case"embed":te("load",e),o=r;break;case"video":case"audio":for(o=0;o<xr.length;o++)te(xr[o],e);o=r;break;case"source":te("error",e),o=r;break;case"img":case"image":case"link":te("error",e),te("load",e),o=r;break;case"details":te("toggle",e),o=r;break;case"input":pu(e,r),o=Mi(e,r),te("invalid",e);break;case"option":o=r;break;case"select":e._wrapperState={wasMultiple:!!r.multiple},o=se({},r,{value:void 0}),te("invalid",e);break;case"textarea":hu(e,r),o=Oi(e,r),te("invalid",e);break;default:o=r}$i(n,o),s=o;for(l in s)if(s.hasOwnProperty(l)){var a=s[l];l==="style"?Nc(e,a):l==="dangerouslySetInnerHTML"?(a=a?a.__html:void 0,a!=null&&Lc(e,a)):l==="children"?typeof a=="string"?(n!=="textarea"||a!=="")&&Ir(e,a):typeof a=="number"&&Ir(e,""+a):l!=="suppressContentEditableWarning"&&l!=="suppressHydrationWarning"&&l!=="autoFocus"&&(Tr.hasOwnProperty(l)?a!=null&&l==="onScroll"&&te("scroll",e):a!=null&&vs(e,l,a,i))}switch(n){case"input":xo(e),mu(e,r,!1);break;case"textarea":xo(e),yu(e);break;case"option":r.value!=null&&e.setAttribute("value",""+Jt(r.value));break;case"select":e.multiple=!!r.multiple,l=r.value,l!=null?Yn(e,!!r.multiple,l,!1):r.defaultValue!=null&&Yn(e,!!r.multiple,r.defaultValue,!0);break;default:typeof o.onClick=="function"&&(e.onclick=rl)}switch(n){case"button":case"input":case"select":case"textarea":r=!!r.autoFocus;break e;case"img":r=!0;break e;default:r=!1}}r&&(t.flags|=4)}t.ref!==null&&(t.flags|=512,t.flags|=2097152)}return Ce(t),null;case 6:if(e&&t.stateNode!=null)Gd(e,t,e.memoizedProps,r);else{if(typeof r!="string"&&t.stateNode===null)throw Error(x(166));if(n=un(Wr.current),un(vt.current),zo(t)){if(r=t.stateNode,n=t.memoizedProps,r[yt]=t,(l=r.nodeValue!==n)&&(e=Be,e!==null))switch(e.tag){case 3:Oo(r.nodeValue,n,(e.mode&1)!==0);break;case 5:e.memoizedProps.suppressHydrationWarning!==!0&&Oo(r.nodeValue,n,(e.mode&1)!==0)}l&&(t.flags|=4)}else r=(n.nodeType===9?n:n.ownerDocument).createTextNode(r),r[yt]=t,t.stateNode=r}return Ce(t),null;case 13:if(ne(le),r=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(oe&&Ye!==null&&(t.mode&1)!==0&&(t.flags&128)===0)md(),Zn(),t.flags|=98560,l=!1;else if(l=zo(t),r!==null&&r.dehydrated!==null){if(e===null){if(!l)throw Error(x(318));if(l=t.memoizedState,l=l!==null?l.dehydrated:null,!l)throw Error(x(317));l[yt]=t}else Zn(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;Ce(t),l=!1}else lt!==null&&(hs(lt),lt=null),l=!0;if(!l)return t.flags&65536?t:null}return(t.flags&128)!==0?(t.lanes=n,t):(r=r!==null,r!==(e!==null&&e.memoizedState!==null)&&r&&(t.child.flags|=8192,(t.mode&1)!==0&&(e===null||(le.current&1)!==0?me===0&&(me=3):ta())),t.updateQueue!==null&&(t.flags|=4),Ce(t),null);case 4:return Gn(),as(e,t),e===null&&Fr(t.stateNode.containerInfo),Ce(t),null;case 10:return js(t.type._context),Ce(t),null;case 17:return De(t.type)&&ol(),Ce(t),null;case 19:if(ne(le),l=t.memoizedState,l===null)return Ce(t),null;if(r=(t.flags&128)!==0,i=l.rendering,i===null)if(r)mr(l,!1);else{if(me!==0||e!==null&&(e.flags&128)!==0)for(e=t.child;e!==null;){if(i=dl(e),i!==null){for(t.flags|=128,mr(l,!1),r=i.updateQueue,r!==null&&(t.updateQueue=r,t.flags|=4),t.subtreeFlags=0,r=n,n=t.child;n!==null;)l=n,e=r,l.flags&=14680066,i=l.alternate,i===null?(l.childLanes=0,l.lanes=e,l.child=null,l.subtreeFlags=0,l.memoizedProps=null,l.memoizedState=null,l.updateQueue=null,l.dependencies=null,l.stateNode=null):(l.childLanes=i.childLanes,l.lanes=i.lanes,l.child=i.child,l.subtreeFlags=0,l.deletions=null,l.memoizedProps=i.memoizedProps,l.memoizedState=i.memoizedState,l.updateQueue=i.updateQueue,l.type=i.type,e=i.dependencies,l.dependencies=e===null?null:{lanes:e.lanes,firstContext:e.firstContext}),n=n.sibling;return G(le,le.current&1|2),t.child}e=e.sibling}l.tail!==null&&ce()>qn&&(t.flags|=128,r=!0,mr(l,!1),t.lanes=4194304)}else{if(!r)if(e=dl(i),e!==null){if(t.flags|=128,r=!0,n=e.updateQueue,n!==null&&(t.updateQueue=n,t.flags|=4),mr(l,!0),l.tail===null&&l.tailMode==="hidden"&&!i.alternate&&!oe)return Ce(t),null}else 2*ce()-l.renderingStartTime>qn&&n!==1073741824&&(t.flags|=128,r=!0,mr(l,!1),t.lanes=4194304);l.isBackwards?(i.sibling=t.child,t.child=i):(n=l.last,n!==null?n.sibling=i:t.child=i,l.last=i)}return l.tail!==null?(t=l.tail,l.rendering=t,l.tail=t.sibling,l.renderingStartTime=ce(),t.sibling=null,n=le.current,G(le,r?n&1|2:n&1),t):(Ce(t),null);case 22:case 23:return ea(),r=t.memoizedState!==null,e!==null&&e.memoizedState!==null!==r&&(t.flags|=8192),r&&(t.mode&1)!==0?(Ae&1073741824)!==0&&(Ce(t),t.subtreeFlags&6&&(t.flags|=8192)):Ce(t),null;case 24:return null;case 25:return null}throw Error(x(156,t.tag))}function n_(e,t){switch(zs(t),t.tag){case 1:return De(t.type)&&ol(),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return Gn(),ne($e),ne(Ee),Ws(),e=t.flags,(e&65536)!==0&&(e&128)===0?(t.flags=e&-65537|128,t):null;case 5:return Bs(t),null;case 13:if(ne(le),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(x(340));Zn()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return ne(le),null;case 4:return Gn(),null;case 10:return js(t.type._context),null;case 22:case 23:return ea(),null;case 24:return null;default:return null}}var Ro=!1,Se=!1,r_=typeof WeakSet=="function"?WeakSet:Set,P=null;function Fn(e,t){var n=e.ref;if(n!==null)if(typeof n=="function")try{n(null)}catch(r){ae(e,t,r)}else n.current=null}function us(e,t,n){try{n()}catch(r){ae(e,t,r)}}var sc=!1;function o_(e,t){if(Xi=el,e=nd(),Is(e)){if("selectionStart"in e)var n={start:e.selectionStart,end:e.selectionEnd};else e:{n=(n=e.ownerDocument)&&n.defaultView||window;var r=n.getSelection&&n.getSelection();if(r&&r.rangeCount!==0){n=r.anchorNode;var o=r.anchorOffset,l=r.focusNode;r=r.focusOffset;try{n.nodeType,l.nodeType}catch{n=null;break e}var i=0,s=-1,a=-1,d=0,g=0,m=e,h=null;t:for(;;){for(var w;m!==n||o!==0&&m.nodeType!==3||(s=i+o),m!==l||r!==0&&m.nodeType!==3||(a=i+r),m.nodeType===3&&(i+=m.nodeValue.length),(w=m.firstChild)!==null;)h=m,m=w;for(;;){if(m===e)break t;if(h===n&&++d===o&&(s=i),h===l&&++g===r&&(a=i),(w=m.nextSibling)!==null)break;m=h,h=m.parentNode}m=w}n=s===-1||a===-1?null:{start:s,end:a}}else n=null}n=n||{start:0,end:0}}else n=null;for(Qi={focusedElem:e,selectionRange:n},el=!1,P=t;P!==null;)if(t=P,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,P=e;else for(;P!==null;){t=P;try{var C=t.alternate;if((t.flags&1024)!==0)switch(t.tag){case 0:case 11:case 15:break;case 1:if(C!==null){var L=C.memoizedProps,J=C.memoizedState,u=t.stateNode,c=u.getSnapshotBeforeUpdate(t.elementType===t.type?L:rt(t.type,L),J);u.__reactInternalSnapshotBeforeUpdate=c}break;case 3:var _=t.stateNode.containerInfo;_.nodeType===1?_.textContent="":_.nodeType===9&&_.documentElement&&_.removeChild(_.documentElement);break;case 5:case 6:case 4:case 17:break;default:throw Error(x(163))}}catch(k){ae(t,t.return,k)}if(e=t.sibling,e!==null){e.return=t.return,P=e;break}P=t.return}return C=sc,sc=!1,C}function Nr(e,t,n){var r=t.updateQueue;if(r=r!==null?r.lastEffect:null,r!==null){var o=r=r.next;do{if((o.tag&e)===e){var l=o.destroy;o.destroy=void 0,l!==void 0&&us(t,n,l)}o=o.next}while(o!==r)}}function Pl(e,t){if(t=t.updateQueue,t=t!==null?t.lastEffect:null,t!==null){var n=t=t.next;do{if((n.tag&e)===e){var r=n.create;n.destroy=r()}n=n.next}while(n!==t)}}function cs(e){var t=e.ref;if(t!==null){var n=e.stateNode;switch(e.tag){case 5:e=n;break;default:e=n}typeof t=="function"?t(e):t.current=e}}function Jd(e){var t=e.alternate;t!==null&&(e.alternate=null,Jd(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&(delete t[yt],delete t[Yr],delete t[Ki],delete t[A0],delete t[Y0])),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}function qd(e){return e.tag===5||e.tag===3||e.tag===4}function ac(e){e:for(;;){for(;e.sibling===null;){if(e.return===null||qd(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.flags&2||e.child===null||e.tag===4)continue e;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function ds(e,t,n){var r=e.tag;if(r===5||r===6)e=e.stateNode,t?n.nodeType===8?n.parentNode.insertBefore(e,t):n.insertBefore(e,t):(n.nodeType===8?(t=n.parentNode,t.insertBefore(e,n)):(t=n,t.appendChild(e)),n=n._reactRootContainer,n!=null||t.onclick!==null||(t.onclick=rl));else if(r!==4&&(e=e.child,e!==null))for(ds(e,t,n),e=e.sibling;e!==null;)ds(e,t,n),e=e.sibling}function fs(e,t,n){var r=e.tag;if(r===5||r===6)e=e.stateNode,t?n.insertBefore(e,t):n.appendChild(e);else if(r!==4&&(e=e.child,e!==null))for(fs(e,t,n),e=e.sibling;e!==null;)fs(e,t,n),e=e.sibling}var ge=null,ot=!1;function Rt(e,t,n){for(n=n.child;n!==null;)ef(e,t,n),n=n.sibling}function ef(e,t,n){if(gt&&typeof gt.onCommitFiberUnmount=="function")try{gt.onCommitFiberUnmount(vl,n)}catch{}switch(n.tag){case 5:Se||Fn(n,t);case 6:var r=ge,o=ot;ge=null,Rt(e,t,n),ge=r,ot=o,ge!==null&&(ot?(e=ge,n=n.stateNode,e.nodeType===8?e.parentNode.removeChild(n):e.removeChild(n)):ge.removeChild(n.stateNode));break;case 18:ge!==null&&(ot?(e=ge,n=n.stateNode,e.nodeType===8?mi(e.parentNode,n):e.nodeType===1&&mi(e,n),Dr(e)):mi(ge,n.stateNode));break;case 4:r=ge,o=ot,ge=n.stateNode.containerInfo,ot=!0,Rt(e,t,n),ge=r,ot=o;break;case 0:case 11:case 14:case 15:if(!Se&&(r=n.updateQueue,r!==null&&(r=r.lastEffect,r!==null))){o=r=r.next;do{var l=o,i=l.destroy;l=l.tag,i!==void 0&&((l&2)!==0||(l&4)!==0)&&us(n,t,i),o=o.next}while(o!==r)}Rt(e,t,n);break;case 1:if(!Se&&(Fn(n,t),r=n.stateNode,typeof r.componentWillUnmount=="function"))try{r.props=n.memoizedProps,r.state=n.memoizedState,r.componentWillUnmount()}catch(s){ae(n,t,s)}Rt(e,t,n);break;case 21:Rt(e,t,n);break;case 22:n.mode&1?(Se=(r=Se)||n.memoizedState!==null,Rt(e,t,n),Se=r):Rt(e,t,n);break;default:Rt(e,t,n)}}function uc(e){var t=e.updateQueue;if(t!==null){e.updateQueue=null;var n=e.stateNode;n===null&&(n=e.stateNode=new r_),t.forEach(function(r){var o=__.bind(null,e,r);n.has(r)||(n.add(r),r.then(o,o))})}}function nt(e,t){var n=t.deletions;if(n!==null)for(var r=0;r<n.length;r++){var o=n[r];try{var l=e,i=t,s=i;e:for(;s!==null;){switch(s.tag){case 5:ge=s.stateNode,ot=!1;break e;case 3:ge=s.stateNode.containerInfo,ot=!0;break e;case 4:ge=s.stateNode.containerInfo,ot=!0;break e}s=s.return}if(ge===null)throw Error(x(160));ef(l,i,o),ge=null,ot=!1;var a=o.alternate;a!==null&&(a.return=null),o.return=null}catch(d){ae(o,t,d)}}if(t.subtreeFlags&12854)for(t=t.child;t!==null;)tf(t,e),t=t.sibling}function tf(e,t){var n=e.alternate,r=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:if(nt(t,e),mt(e),r&4){try{Nr(3,e,e.return),Pl(3,e)}catch(L){ae(e,e.return,L)}try{Nr(5,e,e.return)}catch(L){ae(e,e.return,L)}}break;case 1:nt(t,e),mt(e),r&512&&n!==null&&Fn(n,n.return);break;case 5:if(nt(t,e),mt(e),r&512&&n!==null&&Fn(n,n.return),e.flags&32){var o=e.stateNode;try{Ir(o,"")}catch(L){ae(e,e.return,L)}}if(r&4&&(o=e.stateNode,o!=null)){var l=e.memoizedProps,i=n!==null?n.memoizedProps:l,s=e.type,a=e.updateQueue;if(e.updateQueue=null,a!==null)try{s==="input"&&l.type==="radio"&&l.name!=null&&Cc(o,l),Di(s,i);var d=Di(s,l);for(i=0;i<a.length;i+=2){var g=a[i],m=a[i+1];g==="style"?Nc(o,m):g==="dangerouslySetInnerHTML"?Lc(o,m):g==="children"?Ir(o,m):vs(o,g,m,d)}switch(s){case"input":Ti(o,l);break;case"textarea":Sc(o,l);break;case"select":var h=o._wrapperState.wasMultiple;o._wrapperState.wasMultiple=!!l.multiple;var w=l.value;w!=null?Yn(o,!!l.multiple,w,!1):h!==!!l.multiple&&(l.defaultValue!=null?Yn(o,!!l.multiple,l.defaultValue,!0):Yn(o,!!l.multiple,l.multiple?[]:"",!1))}o[Yr]=l}catch(L){ae(e,e.return,L)}}break;case 6:if(nt(t,e),mt(e),r&4){if(e.stateNode===null)throw Error(x(162));o=e.stateNode,l=e.memoizedProps;try{o.nodeValue=l}catch(L){ae(e,e.return,L)}}break;case 3:if(nt(t,e),mt(e),r&4&&n!==null&&n.memoizedState.isDehydrated)try{Dr(t.containerInfo)}catch(L){ae(e,e.return,L)}break;case 4:nt(t,e),mt(e);break;case 13:nt(t,e),mt(e),o=e.child,o.flags&8192&&(l=o.memoizedState!==null,o.stateNode.isHidden=l,!l||o.alternate!==null&&o.alternate.memoizedState!==null||(Js=ce())),r&4&&uc(e);break;case 22:if(g=n!==null&&n.memoizedState!==null,e.mode&1?(Se=(d=Se)||g,nt(t,e),Se=d):nt(t,e),mt(e),r&8192){if(d=e.memoizedState!==null,(e.stateNode.isHidden=d)&&!g&&(e.mode&1)!==0)for(P=e,g=e.child;g!==null;){for(m=P=g;P!==null;){switch(h=P,w=h.child,h.tag){case 0:case 11:case 14:case 15:Nr(4,h,h.return);break;case 1:Fn(h,h.return);var C=h.stateNode;if(typeof C.componentWillUnmount=="function"){r=h,n=h.return;try{t=r,C.props=t.memoizedProps,C.state=t.memoizedState,C.componentWillUnmount()}catch(L){ae(r,n,L)}}break;case 5:Fn(h,h.return);break;case 22:if(h.memoizedState!==null){dc(m);continue}}w!==null?(w.return=h,P=w):dc(m)}g=g.sibling}e:for(g=null,m=e;;){if(m.tag===5){if(g===null){g=m;try{o=m.stateNode,d?(l=o.style,typeof l.setProperty=="function"?l.setProperty("display","none","important"):l.display="none"):(s=m.stateNode,a=m.memoizedProps.style,i=a!=null&&a.hasOwnProperty("display")?a.display:null,s.style.display=Pc("display",i))}catch(L){ae(e,e.return,L)}}}else if(m.tag===6){if(g===null)try{m.stateNode.nodeValue=d?"":m.memoizedProps}catch(L){ae(e,e.return,L)}}else if((m.tag!==22&&m.tag!==23||m.memoizedState===null||m===e)&&m.child!==null){m.child.return=m,m=m.child;continue}if(m===e)break e;for(;m.sibling===null;){if(m.return===null||m.return===e)break e;g===m&&(g=null),m=m.return}g===m&&(g=null),m.sibling.return=m.return,m=m.sibling}}break;case 19:nt(t,e),mt(e),r&4&&uc(e);break;case 21:break;default:nt(t,e),mt(e)}}function mt(e){var t=e.flags;if(t&2){try{e:{for(var n=e.return;n!==null;){if(qd(n)){var r=n;break e}n=n.return}throw Error(x(160))}switch(r.tag){case 5:var o=r.stateNode;r.flags&32&&(Ir(o,""),r.flags&=-33);var l=ac(e);fs(e,l,o);break;case 3:case 4:var i=r.stateNode.containerInfo,s=ac(e);ds(e,s,i);break;default:throw Error(x(161))}}catch(a){ae(e,e.return,a)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function l_(e,t,n){P=e,nf(e,t,n)}function nf(e,t,n){for(var r=(e.mode&1)!==0;P!==null;){var o=P,l=o.child;if(o.tag===22&&r){var i=o.memoizedState!==null||Ro;if(!i){var s=o.alternate,a=s!==null&&s.memoizedState!==null||Se;s=Ro;var d=Se;if(Ro=i,(Se=a)&&!d)for(P=o;P!==null;)i=P,a=i.child,i.tag===22&&i.memoizedState!==null?fc(o):a!==null?(a.return=i,P=a):fc(o);for(;l!==null;)P=l,nf(l,t,n),l=l.sibling;P=o,Ro=s,Se=d}cc(e,t,n)}else(o.subtreeFlags&8772)!==0&&l!==null?(l.return=o,P=l):cc(e,t,n)}}function cc(e){for(;P!==null;){var t=P;if((t.flags&8772)!==0){var n=t.alternate;try{if((t.flags&8772)!==0)switch(t.tag){case 0:case 11:case 15:Se||Pl(5,t);break;case 1:var r=t.stateNode;if(t.flags&4&&!Se)if(n===null)r.componentDidMount();else{var o=t.elementType===t.type?n.memoizedProps:rt(t.type,n.memoizedProps);r.componentDidUpdate(o,n.memoizedState,r.__reactInternalSnapshotBeforeUpdate)}var l=t.updateQueue;l!==null&&Vu(t,l,r);break;case 3:var i=t.updateQueue;if(i!==null){if(n=null,t.child!==null)switch(t.child.tag){case 5:n=t.child.stateNode;break;case 1:n=t.child.stateNode}Vu(t,i,n)}break;case 5:var s=t.stateNode;if(n===null&&t.flags&4){n=s;var a=t.memoizedProps;switch(t.type){case"button":case"input":case"select":case"textarea":a.autoFocus&&n.focus();break;case"img":a.src&&(n.src=a.src)}}break;case 6:break;case 4:break;case 12:break;case 13:if(t.memoizedState===null){var d=t.alternate;if(d!==null){var g=d.memoizedState;if(g!==null){var m=g.dehydrated;m!==null&&Dr(m)}}}break;case 19:case 17:case 21:case 22:case 23:case 25:break;default:throw Error(x(163))}Se||t.flags&512&&cs(t)}catch(h){ae(t,t.return,h)}}if(t===e){P=null;break}if(n=t.sibling,n!==null){n.return=t.return,P=n;break}P=t.return}}function dc(e){for(;P!==null;){var t=P;if(t===e){P=null;break}var n=t.sibling;if(n!==null){n.return=t.return,P=n;break}P=t.return}}function fc(e){for(;P!==null;){var t=P;try{switch(t.tag){case 0:case 11:case 15:var n=t.return;try{Pl(4,t)}catch(a){ae(t,n,a)}break;case 1:var r=t.stateNode;if(typeof r.componentDidMount=="function"){var o=t.return;try{r.componentDidMount()}catch(a){ae(t,o,a)}}var l=t.return;try{cs(t)}catch(a){ae(t,l,a)}break;case 5:var i=t.return;try{cs(t)}catch(a){ae(t,i,a)}}}catch(a){ae(t,t.return,a)}if(t===e){P=null;break}var s=t.sibling;if(s!==null){s.return=t.return,P=s;break}P=t.return}}var i_=Math.ceil,pl=zt.ReactCurrentDispatcher,Ks=zt.ReactCurrentOwner,Ge=zt.ReactCurrentBatchConfig,B=0,ye=null,de=null,ve=0,Ae=0,An=tn(0),me=0,Qr=null,mn=0,Nl=0,Gs=0,br=null,Oe=null,Js=0,qn=1/0,Et=null,ml=!1,_s=null,Zt=null,jo=!1,Wt=null,hl=0,Mr=0,ps=null,Xo=-1,Qo=0;function Me(){return(B&6)!==0?ce():Xo!==-1?Xo:Xo=ce()}function Kt(e){return(e.mode&1)===0?1:(B&2)!==0&&ve!==0?ve&-ve:W0.transition!==null?(Qo===0&&(Qo=Ac()),Qo):(e=Q,e!==0||(e=window.event,e=e===void 0?16:Qc(e.type)),e)}function st(e,t,n,r){if(50<Mr)throw Mr=0,ps=null,Error(x(185));Vr(e,n,r),((B&2)===0||e!==ye)&&(e===ye&&((B&2)===0&&(Nl|=n),me===4&&Yt(e,ve)),Re(e,r),n===1&&B===0&&(t.mode&1)===0&&(qn=ce()+500,Sl&&nn()))}function Re(e,t){var n=e.callbackNode;H1(e,t);var r=qo(e,e===ye?ve:0);if(r===0)n!==null&&ku(n),e.callbackNode=null,e.callbackPriority=0;else if(t=r&-r,e.callbackPriority!==t){if(n!=null&&ku(n),t===1)e.tag===0?B0(_c.bind(null,e)):fd(_c.bind(null,e)),j0(function(){(B&6)===0&&nn()}),n=null;else{switch(Yc(r)){case 1:n=Ss;break;case 4:n=jc;break;case 16:n=Jo;break;case 536870912:n=Fc;break;default:n=Jo}n=df(n,rf.bind(null,e))}e.callbackPriority=t,e.callbackNode=n}}function rf(e,t){if(Xo=-1,Qo=0,(B&6)!==0)throw Error(x(327));var n=e.callbackNode;if(Xn()&&e.callbackNode!==n)return null;var r=qo(e,e===ye?ve:0);if(r===0)return null;if((r&30)!==0||(r&e.expiredLanes)!==0||t)t=yl(e,r);else{t=r;var o=B;B|=2;var l=lf();(ye!==e||ve!==t)&&(Et=null,qn=ce()+500,cn(e,t));do try{u_();break}catch(s){of(e,s)}while(!0);Rs(),pl.current=l,B=o,de!==null?t=0:(ye=null,ve=0,t=me)}if(t!==0){if(t===2&&(o=Yi(e),o!==0&&(r=o,t=ms(e,o))),t===1)throw n=Qr,cn(e,0),Yt(e,r),Re(e,ce()),n;if(t===6)Yt(e,r);else{if(o=e.current.alternate,(r&30)===0&&!s_(o)&&(t=yl(e,r),t===2&&(l=Yi(e),l!==0&&(r=l,t=ms(e,l))),t===1))throw n=Qr,cn(e,0),Yt(e,r),Re(e,ce()),n;switch(e.finishedWork=o,e.finishedLanes=r,t){case 0:case 1:throw Error(x(345));case 2:ln(e,Oe,Et);break;case 3:if(Yt(e,r),(r&130023424)===r&&(t=Js+500-ce(),10<t)){if(qo(e,0)!==0)break;if(o=e.suspendedLanes,(o&r)!==r){Me(),e.pingedLanes|=e.suspendedLanes&o;break}e.timeoutHandle=Zi(ln.bind(null,e,Oe,Et),t);break}ln(e,Oe,Et);break;case 4:if(Yt(e,r),(r&4194240)===r)break;for(t=e.eventTimes,o=-1;0<r;){var i=31-it(r);l=1<<i,i=t[i],i>o&&(o=i),r&=~l}if(r=o,r=ce()-r,r=(120>r?120:480>r?480:1080>r?1080:1920>r?1920:3e3>r?3e3:4320>r?4320:1960*i_(r/1960))-r,10<r){e.timeoutHandle=Zi(ln.bind(null,e,Oe,Et),r);break}ln(e,Oe,Et);break;case 5:ln(e,Oe,Et);break;default:throw Error(x(329))}}}return Re(e,ce()),e.callbackNode===n?rf.bind(null,e):null}function ms(e,t){var n=br;return e.current.memoizedState.isDehydrated&&(cn(e,t).flags|=256),e=yl(e,t),e!==2&&(t=Oe,Oe=n,t!==null&&hs(t)),e}function hs(e){Oe===null?Oe=e:Oe.push.apply(Oe,e)}function s_(e){for(var t=e;;){if(t.flags&16384){var n=t.updateQueue;if(n!==null&&(n=n.stores,n!==null))for(var r=0;r<n.length;r++){var o=n[r],l=o.getSnapshot;o=o.value;try{if(!at(l(),o))return!1}catch{return!1}}}if(n=t.child,t.subtreeFlags&16384&&n!==null)n.return=t,t=n;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function Yt(e,t){for(t&=~Gs,t&=~Nl,e.suspendedLanes|=t,e.pingedLanes&=~t,e=e.expirationTimes;0<t;){var n=31-it(t),r=1<<n;e[n]=-1,t&=~r}}function _c(e){if((B&6)!==0)throw Error(x(327));Xn();var t=qo(e,0);if((t&1)===0)return Re(e,ce()),null;var n=yl(e,t);if(e.tag!==0&&n===2){var r=Yi(e);r!==0&&(t=r,n=ms(e,r))}if(n===1)throw n=Qr,cn(e,0),Yt(e,t),Re(e,ce()),n;if(n===6)throw Error(x(345));return e.finishedWork=e.current.alternate,e.finishedLanes=t,ln(e,Oe,Et),Re(e,ce()),null}function qs(e,t){var n=B;B|=1;try{return e(t)}finally{B=n,B===0&&(qn=ce()+500,Sl&&nn())}}function hn(e){Wt!==null&&Wt.tag===0&&(B&6)===0&&Xn();var t=B;B|=1;var n=Ge.transition,r=Q;try{if(Ge.transition=null,Q=1,e)return e()}finally{Q=r,Ge.transition=n,B=t,(B&6)===0&&nn()}}function ea(){Ae=An.current,ne(An)}function cn(e,t){e.finishedWork=null,e.finishedLanes=0;var n=e.timeoutHandle;if(n!==-1&&(e.timeoutHandle=-1,R0(n)),de!==null)for(n=de.return;n!==null;){var r=n;switch(zs(r),r.tag){case 1:r=r.type.childContextTypes,r!=null&&ol();break;case 3:Gn(),ne($e),ne(Ee),Ws();break;case 5:Bs(r);break;case 4:Gn();break;case 13:ne(le);break;case 19:ne(le);break;case 10:js(r.type._context);break;case 22:case 23:ea()}n=n.return}if(ye=e,de=e=Gt(e.current,null),ve=Ae=t,me=0,Qr=null,Gs=Nl=mn=0,Oe=br=null,an!==null){for(t=0;t<an.length;t++)if(n=an[t],r=n.interleaved,r!==null){n.interleaved=null;var o=r.next,l=n.pending;if(l!==null){var i=l.next;l.next=o,r.next=i}n.pending=r}an=null}return e}function of(e,t){do{var n=de;try{if(Rs(),Wo.current=_l,fl){for(var r=ie.memoizedState;r!==null;){var o=r.queue;o!==null&&(o.pending=null),r=r.next}fl=!1}if(pn=0,he=pe=ie=null,Pr=!1,Ur=0,Ks.current=null,n===null||n.return===null){me=1,Qr=t,de=null;break}e:{var l=e,i=n.return,s=n,a=t;if(t=ve,s.flags|=32768,a!==null&&typeof a=="object"&&typeof a.then=="function"){var d=a,g=s,m=g.tag;if((g.mode&1)===0&&(m===0||m===11||m===15)){var h=g.alternate;h?(g.updateQueue=h.updateQueue,g.memoizedState=h.memoizedState,g.lanes=h.lanes):(g.updateQueue=null,g.memoizedState=null)}var w=ec(i);if(w!==null){w.flags&=-257,tc(w,i,s,l,t),w.mode&1&&qu(l,d,t),t=w,a=d;var C=t.updateQueue;if(C===null){var L=new Set;L.add(a),t.updateQueue=L}else C.add(a);break e}else{if((t&1)===0){qu(l,d,t),ta();break e}a=Error(x(426))}}else if(oe&&s.mode&1){var J=ec(i);if(J!==null){(J.flags&65536)===0&&(J.flags|=256),tc(J,i,s,l,t),$s(Jn(a,s));break e}}l=a=Jn(a,s),me!==4&&(me=2),br===null?br=[l]:br.push(l),l=i;do{switch(l.tag){case 3:l.flags|=65536,t&=-t,l.lanes|=t;var u=Yd(l,a,t);Qu(l,u);break e;case 1:s=a;var c=l.type,_=l.stateNode;if((l.flags&128)===0&&(typeof c.getDerivedStateFromError=="function"||_!==null&&typeof _.componentDidCatch=="function"&&(Zt===null||!Zt.has(_)))){l.flags|=65536,t&=-t,l.lanes|=t;var k=Bd(l,s,t);Qu(l,k);break e}}l=l.return}while(l!==null)}af(n)}catch(N){t=N,de===n&&n!==null&&(de=n=n.return);continue}break}while(!0)}function lf(){var e=pl.current;return pl.current=_l,e===null?_l:e}function ta(){(me===0||me===3||me===2)&&(me=4),ye===null||(mn&268435455)===0&&(Nl&268435455)===0||Yt(ye,ve)}function yl(e,t){var n=B;B|=2;var r=lf();(ye!==e||ve!==t)&&(Et=null,cn(e,t));do try{a_();break}catch(o){of(e,o)}while(!0);if(Rs(),B=n,pl.current=r,de!==null)throw Error(x(261));return ye=null,ve=0,me}function a_(){for(;de!==null;)sf(de)}function u_(){for(;de!==null&&!D1();)sf(de)}function sf(e){var t=cf(e.alternate,e,Ae);e.memoizedProps=e.pendingProps,t===null?af(e):de=t,Ks.current=null}function af(e){var t=e;do{var n=t.alternate;if(e=t.return,(t.flags&32768)===0){if(n=t_(n,t,Ae),n!==null){de=n;return}}else{if(n=n_(n,t),n!==null){n.flags&=32767,de=n;return}if(e!==null)e.flags|=32768,e.subtreeFlags=0,e.deletions=null;else{me=6,de=null;return}}if(t=t.sibling,t!==null){de=t;return}de=t=e}while(t!==null);me===0&&(me=5)}function ln(e,t,n){var r=Q,o=Ge.transition;try{Ge.transition=null,Q=1,c_(e,t,n,r)}finally{Ge.transition=o,Q=r}return null}function c_(e,t,n,r){do Xn();while(Wt!==null);if((B&6)!==0)throw Error(x(327));n=e.finishedWork;var o=e.finishedLanes;if(n===null)return null;if(e.finishedWork=null,e.finishedLanes=0,n===e.current)throw Error(x(177));e.callbackNode=null,e.callbackPriority=0;var l=n.lanes|n.childLanes;if(X1(e,l),e===ye&&(de=ye=null,ve=0),(n.subtreeFlags&2064)===0&&(n.flags&2064)===0||jo||(jo=!0,df(Jo,function(){return Xn(),null})),l=(n.flags&15990)!==0,(n.subtreeFlags&15990)!==0||l){l=Ge.transition,Ge.transition=null;var i=Q;Q=1;var s=B;B|=4,Ks.current=null,o_(e,n),tf(n,e),I0(Qi),el=!!Xi,Qi=Xi=null,e.current=n,l_(n,e,o),R1(),B=s,Q=i,Ge.transition=l}else e.current=n;if(jo&&(jo=!1,Wt=e,hl=o),l=e.pendingLanes,l===0&&(Zt=null),A1(n.stateNode,r),Re(e,ce()),t!==null)for(r=e.onRecoverableError,n=0;n<t.length;n++)o=t[n],r(o.value,{componentStack:o.stack,digest:o.digest});if(ml)throw ml=!1,e=_s,_s=null,e;return(hl&1)!==0&&e.tag!==0&&Xn(),l=e.pendingLanes,(l&1)!==0?e===ps?Mr++:(Mr=0,ps=e):Mr=0,nn(),null}function Xn(){if(Wt!==null){var e=Yc(hl),t=Ge.transition,n=Q;try{if(Ge.transition=null,Q=16>e?16:e,Wt===null)var r=!1;else{if(e=Wt,Wt=null,hl=0,(B&6)!==0)throw Error(x(331));var o=B;for(B|=4,P=e.current;P!==null;){var l=P,i=l.child;if((P.flags&16)!==0){var s=l.deletions;if(s!==null){for(var a=0;a<s.length;a++){var d=s[a];for(P=d;P!==null;){var g=P;switch(g.tag){case 0:case 11:case 15:Nr(8,g,l)}var m=g.child;if(m!==null)m.return=g,P=m;else for(;P!==null;){g=P;var h=g.sibling,w=g.return;if(Jd(g),g===d){P=null;break}if(h!==null){h.return=w,P=h;break}P=w}}}var C=l.alternate;if(C!==null){var L=C.child;if(L!==null){C.child=null;do{var J=L.sibling;L.sibling=null,L=J}while(L!==null)}}P=l}}if((l.subtreeFlags&2064)!==0&&i!==null)i.return=l,P=i;else e:for(;P!==null;){if(l=P,(l.flags&2048)!==0)switch(l.tag){case 0:case 11:case 15:Nr(9,l,l.return)}var u=l.sibling;if(u!==null){u.return=l.return,P=u;break e}P=l.return}}var c=e.current;for(P=c;P!==null;){i=P;var _=i.child;if((i.subtreeFlags&2064)!==0&&_!==null)_.return=i,P=_;else e:for(i=c;P!==null;){if(s=P,(s.flags&2048)!==0)try{switch(s.tag){case 0:case 11:case 15:Pl(9,s)}}catch(N){ae(s,s.return,N)}if(s===i){P=null;break e}var k=s.sibling;if(k!==null){k.return=s.return,P=k;break e}P=s.return}}if(B=o,nn(),gt&&typeof gt.onPostCommitFiberRoot=="function")try{gt.onPostCommitFiberRoot(vl,e)}catch{}r=!0}return r}finally{Q=n,Ge.transition=t}}return!1}function pc(e,t,n){t=Jn(n,t),t=Yd(e,t,1),e=Vt(e,t,1),t=Me(),e!==null&&(Vr(e,1,t),Re(e,t))}function ae(e,t,n){if(e.tag===3)pc(e,e,n);else for(;t!==null;){if(t.tag===3){pc(t,e,n);break}else if(t.tag===1){var r=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof r.componentDidCatch=="function"&&(Zt===null||!Zt.has(r))){e=Jn(n,e),e=Bd(t,e,1),t=Vt(t,e,1),e=Me(),t!==null&&(Vr(t,1,e),Re(t,e));break}}t=t.return}}function d_(e,t,n){var r=e.pingCache;r!==null&&r.delete(t),t=Me(),e.pingedLanes|=e.suspendedLanes&n,ye===e&&(ve&n)===n&&(me===4||me===3&&(ve&130023424)===ve&&500>ce()-Js?cn(e,0):Gs|=n),Re(e,t)}function uf(e,t){t===0&&((e.mode&1)===0?t=1:(t=So,So<<=1,(So&130023424)===0&&(So=4194304)));var n=Me();e=It(e,t),e!==null&&(Vr(e,t,n),Re(e,n))}function f_(e){var t=e.memoizedState,n=0;t!==null&&(n=t.retryLane),uf(e,n)}function __(e,t){var n=0;switch(e.tag){case 13:var r=e.stateNode,o=e.memoizedState;o!==null&&(n=o.retryLane);break;case 19:r=e.stateNode;break;default:throw Error(x(314))}r!==null&&r.delete(t),uf(e,n)}var cf;cf=function(e,t,n){if(e!==null)if(e.memoizedProps!==t.pendingProps||$e.current)ze=!0;else{if((e.lanes&n)===0&&(t.flags&128)===0)return ze=!1,e_(e,t,n);ze=(e.flags&131072)!==0}else ze=!1,oe&&(t.flags&1048576)!==0&&_d(t,sl,t.index);switch(t.lanes=0,t.tag){case 2:var r=t.type;Ho(e,t),e=t.pendingProps;var o=Vn(t,Ee.current);Hn(t,n),o=Hs(null,t,r,e,o,n);var l=Xs();return t.flags|=1,typeof o=="object"&&o!==null&&typeof o.render=="function"&&o.$$typeof===void 0?(t.tag=1,t.memoizedState=null,t.updateQueue=null,De(r)?(l=!0,ll(t)):l=!1,t.memoizedState=o.state!==null&&o.state!==void 0?o.state:null,As(t),o.updater=Ll,t.stateNode=o,o._reactInternals=t,ns(t,r,e,n),t=ls(null,t,r,!0,l,n)):(t.tag=0,oe&&l&&Os(t),be(null,t,o,n),t=t.child),t;case 16:r=t.elementType;e:{switch(Ho(e,t),e=t.pendingProps,o=r._init,r=o(r._payload),t.type=r,o=t.tag=m_(r),e=rt(r,e),o){case 0:t=os(null,t,r,e,n);break e;case 1:t=oc(null,t,r,e,n);break e;case 11:t=nc(null,t,r,e,n);break e;case 14:t=rc(null,t,r,rt(r.type,e),n);break e}throw Error(x(306,r,""))}return t;case 0:return r=t.type,o=t.pendingProps,o=t.elementType===r?o:rt(r,o),os(e,t,r,o,n);case 1:return r=t.type,o=t.pendingProps,o=t.elementType===r?o:rt(r,o),oc(e,t,r,o,n);case 3:e:{if(Xd(t),e===null)throw Error(x(387));r=t.pendingProps,l=t.memoizedState,o=l.element,vd(e,t),cl(t,r,null,n);var i=t.memoizedState;if(r=i.element,l.isDehydrated)if(l={element:r,isDehydrated:!1,cache:i.cache,pendingSuspenseBoundaries:i.pendingSuspenseBoundaries,transitions:i.transitions},t.updateQueue.baseState=l,t.memoizedState=l,t.flags&256){o=Jn(Error(x(423)),t),t=lc(e,t,r,n,o);break e}else if(r!==o){o=Jn(Error(x(424)),t),t=lc(e,t,r,n,o);break e}else for(Ye=Qt(t.stateNode.containerInfo.firstChild),Be=t,oe=!0,lt=null,n=yd(t,null,r,n),t.child=n;n;)n.flags=n.flags&-3|4096,n=n.sibling;else{if(Zn(),r===o){t=Ot(e,t,n);break e}be(e,t,r,n)}t=t.child}return t;case 5:return kd(t),e===null&&qi(t),r=t.type,o=t.pendingProps,l=e!==null?e.memoizedProps:null,i=o.children,Vi(r,o)?i=null:l!==null&&Vi(r,l)&&(t.flags|=32),Hd(e,t),be(e,t,i,n),t.child;case 6:return e===null&&qi(t),null;case 13:return Qd(e,t,n);case 4:return Ys(t,t.stateNode.containerInfo),r=t.pendingProps,e===null?t.child=Kn(t,null,r,n):be(e,t,r,n),t.child;case 11:return r=t.type,o=t.pendingProps,o=t.elementType===r?o:rt(r,o),nc(e,t,r,o,n);case 7:return be(e,t,t.pendingProps,n),t.child;case 8:return be(e,t,t.pendingProps.children,n),t.child;case 12:return be(e,t,t.pendingProps.children,n),t.child;case 10:e:{if(r=t.type._context,o=t.pendingProps,l=t.memoizedProps,i=o.value,G(al,r._currentValue),r._currentValue=i,l!==null)if(at(l.value,i)){if(l.children===o.children&&!$e.current){t=Ot(e,t,n);break e}}else for(l=t.child,l!==null&&(l.return=t);l!==null;){var s=l.dependencies;if(s!==null){i=l.child;for(var a=s.firstContext;a!==null;){if(a.context===r){if(l.tag===1){a=bt(-1,n&-n),a.tag=2;var d=l.updateQueue;if(d!==null){d=d.shared;var g=d.pending;g===null?a.next=a:(a.next=g.next,g.next=a),d.pending=a}}l.lanes|=n,a=l.alternate,a!==null&&(a.lanes|=n),es(l.return,n,t),s.lanes|=n;break}a=a.next}}else if(l.tag===10)i=l.type===t.type?null:l.child;else if(l.tag===18){if(i=l.return,i===null)throw Error(x(341));i.lanes|=n,s=i.alternate,s!==null&&(s.lanes|=n),es(i,n,t),i=l.sibling}else i=l.child;if(i!==null)i.return=l;else for(i=l;i!==null;){if(i===t){i=null;break}if(l=i.sibling,l!==null){l.return=i.return,i=l;break}i=i.return}l=i}be(e,t,o.children,n),t=t.child}return t;case 9:return o=t.type,r=t.pendingProps.children,Hn(t,n),o=Je(o),r=r(o),t.flags|=1,be(e,t,r,n),t.child;case 14:return r=t.type,o=rt(r,t.pendingProps),o=rt(r.type,o),rc(e,t,r,o,n);case 15:return Wd(e,t,t.type,t.pendingProps,n);case 17:return r=t.type,o=t.pendingProps,o=t.elementType===r?o:rt(r,o),Ho(e,t),t.tag=1,De(r)?(e=!0,ll(t)):e=!1,Hn(t,n),Ad(t,r,o),ns(t,r,o,n),ls(null,t,r,!0,e,n);case 19:return Vd(e,t,n);case 22:return Ud(e,t,n)}throw Error(x(156,t.tag))};function df(e,t){return Rc(e,t)}function p_(e,t,n,r){this.tag=e,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=r,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Ke(e,t,n,r){return new p_(e,t,n,r)}function na(e){return e=e.prototype,!(!e||!e.isReactComponent)}function m_(e){if(typeof e=="function")return na(e)?1:0;if(e!=null){if(e=e.$$typeof,e===xs)return 11;if(e===ws)return 14}return 2}function Gt(e,t){var n=e.alternate;return n===null?(n=Ke(e.tag,t,e.key,e.mode),n.elementType=e.elementType,n.type=e.type,n.stateNode=e.stateNode,n.alternate=e,e.alternate=n):(n.pendingProps=t,n.type=e.type,n.flags=0,n.subtreeFlags=0,n.deletions=null),n.flags=e.flags&14680064,n.childLanes=e.childLanes,n.lanes=e.lanes,n.child=e.child,n.memoizedProps=e.memoizedProps,n.memoizedState=e.memoizedState,n.updateQueue=e.updateQueue,t=e.dependencies,n.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},n.sibling=e.sibling,n.index=e.index,n.ref=e.ref,n}function Vo(e,t,n,r,o,l){var i=2;if(r=e,typeof e=="function")na(e)&&(i=1);else if(typeof e=="string")i=5;else e:switch(e){case Mn:return dn(n.children,o,l,t);case ks:i=8,o|=8;break;case Li:return e=Ke(12,n,t,o|2),e.elementType=Li,e.lanes=l,e;case Pi:return e=Ke(13,n,t,o),e.elementType=Pi,e.lanes=l,e;case Ni:return e=Ke(19,n,t,o),e.elementType=Ni,e.lanes=l,e;case kc:return bl(n,o,l,t);default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case gc:i=10;break e;case vc:i=9;break e;case xs:i=11;break e;case ws:i=14;break e;case jt:i=16,r=null;break e}throw Error(x(130,e==null?e:typeof e,""))}return t=Ke(i,n,t,o),t.elementType=e,t.type=r,t.lanes=l,t}function dn(e,t,n,r){return e=Ke(7,e,r,t),e.lanes=n,e}function bl(e,t,n,r){return e=Ke(22,e,r,t),e.elementType=kc,e.lanes=n,e.stateNode={isHidden:!1},e}function Ci(e,t,n){return e=Ke(6,e,null,t),e.lanes=n,e}function Si(e,t,n){return t=Ke(4,e.children!==null?e.children:[],e.key,t),t.lanes=n,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}function h_(e,t,n,r,o){this.tag=t,this.containerInfo=e,this.finishedWork=this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.pendingContext=this.context=null,this.callbackPriority=0,this.eventTimes=si(0),this.expirationTimes=si(-1),this.entangledLanes=this.finishedLanes=this.mutableReadLanes=this.expiredLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=si(0),this.identifierPrefix=r,this.onRecoverableError=o,this.mutableSourceEagerHydrationData=null}function ra(e,t,n,r,o,l,i,s,a){return e=new h_(e,t,n,s,a),t===1?(t=1,l===!0&&(t|=8)):t=0,l=Ke(3,null,null,t),e.current=l,l.stateNode=e,l.memoizedState={element:r,isDehydrated:n,cache:null,transitions:null,pendingSuspenseBoundaries:null},As(l),e}function y_(e,t,n){var r=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:bn,key:r==null?null:""+r,children:e,containerInfo:t,implementation:n}}function ff(e){if(!e)return qt;e=e._reactInternals;e:{if(gn(e)!==e||e.tag!==1)throw Error(x(170));var t=e;do{switch(t.tag){case 3:t=t.stateNode.context;break e;case 1:if(De(t.type)){t=t.stateNode.__reactInternalMemoizedMergedChildContext;break e}}t=t.return}while(t!==null);throw Error(x(171))}if(e.tag===1){var n=e.type;if(De(n))return dd(e,n,t)}return t}function _f(e,t,n,r,o,l,i,s,a){return e=ra(n,r,!0,e,o,l,i,s,a),e.context=ff(null),n=e.current,r=Me(),o=Kt(n),l=bt(r,o),l.callback=t??null,Vt(n,l,o),e.current.lanes=o,Vr(e,o,r),Re(e,r),e}function Ml(e,t,n,r){var o=t.current,l=Me(),i=Kt(o);return n=ff(n),t.context===null?t.context=n:t.pendingContext=n,t=bt(l,i),t.payload={element:e},r=r===void 0?null:r,r!==null&&(t.callback=r),e=Vt(o,t,i),e!==null&&(st(e,o,i,l),Bo(e,o,i)),i}function gl(e){if(e=e.current,!e.child)return null;switch(e.child.tag){case 5:return e.child.stateNode;default:return e.child.stateNode}}function mc(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var n=e.retryLane;e.retryLane=n!==0&&n<t?n:t}}function oa(e,t){mc(e,t),(e=e.alternate)&&mc(e,t)}function g_(){return null}var pf=typeof reportError=="function"?reportError:function(e){console.error(e)};function la(e){this._internalRoot=e}Tl.prototype.render=la.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(x(409));Ml(e,t,null,null)};Tl.prototype.unmount=la.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;hn(function(){Ml(null,e,null,null)}),t[Tt]=null}};function Tl(e){this._internalRoot=e}Tl.prototype.unstable_scheduleHydration=function(e){if(e){var t=Uc();e={blockedOn:null,target:e,priority:t};for(var n=0;n<At.length&&t!==0&&t<At[n].priority;n++);At.splice(n,0,e),n===0&&Xc(e)}};function ia(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function Il(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11&&(e.nodeType!==8||e.nodeValue!==" react-mount-point-unstable "))}function hc(){}function v_(e,t,n,r,o){if(o){if(typeof r=="function"){var l=r;r=function(){var d=gl(i);l.call(d)}}var i=_f(t,r,e,0,null,!1,!1,"",hc);return e._reactRootContainer=i,e[Tt]=i.current,Fr(e.nodeType===8?e.parentNode:e),hn(),i}for(;o=e.lastChild;)e.removeChild(o);if(typeof r=="function"){var s=r;r=function(){var d=gl(a);s.call(d)}}var a=ra(e,0,!1,null,null,!1,!1,"",hc);return e._reactRootContainer=a,e[Tt]=a.current,Fr(e.nodeType===8?e.parentNode:e),hn(function(){Ml(t,a,n,r)}),a}function Ol(e,t,n,r,o){var l=n._reactRootContainer;if(l){var i=l;if(typeof o=="function"){var s=o;o=function(){var a=gl(i);s.call(a)}}Ml(t,i,e,o)}else i=v_(n,t,e,o,r);return gl(i)}Bc=function(e){switch(e.tag){case 3:var t=e.stateNode;if(t.current.memoizedState.isDehydrated){var n=kr(t.pendingLanes);n!==0&&(Es(t,n|1),Re(t,ce()),(B&6)===0&&(qn=ce()+500,nn()))}break;case 13:hn(function(){var r=It(e,1);if(r!==null){var o=Me();st(r,e,1,o)}}),oa(e,1)}};Ls=function(e){if(e.tag===13){var t=It(e,134217728);if(t!==null){var n=Me();st(t,e,134217728,n)}oa(e,134217728)}};Wc=function(e){if(e.tag===13){var t=Kt(e),n=It(e,t);if(n!==null){var r=Me();st(n,e,t,r)}oa(e,t)}};Uc=function(){return Q};Hc=function(e,t){var n=Q;try{return Q=e,t()}finally{Q=n}};ji=function(e,t,n){switch(t){case"input":if(Ti(e,n),t=n.name,n.type==="radio"&&t!=null){for(n=e;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll("input[name="+JSON.stringify(""+t)+'][type="radio"]'),t=0;t<n.length;t++){var r=n[t];if(r!==e&&r.form===e.form){var o=Cl(r);if(!o)throw Error(x(90));wc(r),Ti(r,o)}}}break;case"textarea":Sc(e,n);break;case"select":t=n.value,t!=null&&Yn(e,!!n.multiple,t,!1)}};Tc=qs;Ic=hn;var k_={usingClientEntryPoint:!1,Events:[Kr,zn,Cl,bc,Mc,qs]},hr={findFiberByHostInstance:sn,bundleType:0,version:"18.3.1",rendererPackageName:"react-dom"},x_={bundleType:hr.bundleType,version:hr.version,rendererPackageName:hr.rendererPackageName,rendererConfig:hr.rendererConfig,overrideHookState:null,overrideHookStateDeletePath:null,overrideHookStateRenamePath:null,overrideProps:null,overridePropsDeletePath:null,overridePropsRenamePath:null,setErrorHandler:null,setSuspenseHandler:null,scheduleUpdate:null,currentDispatcherRef:zt.ReactCurrentDispatcher,findHostInstanceByFiber:function(e){return e=$c(e),e===null?null:e.stateNode},findFiberByHostInstance:hr.findFiberByHostInstance||g_,findHostInstancesForRefresh:null,scheduleRefresh:null,scheduleRoot:null,setRefreshHandler:null,getCurrentFiber:null,reconcilerVersion:"18.3.1-next-f1338f8080-20240426"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"&&(yr=__REACT_DEVTOOLS_GLOBAL_HOOK__,!yr.isDisabled&&yr.supportsFiber))try{vl=yr.inject(x_),gt=yr}catch{}var yr;He.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=k_;He.createPortal=function(e,t){var n=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!ia(t))throw Error(x(200));return y_(e,t,null,n)};He.createRoot=function(e,t){if(!ia(e))throw Error(x(299));var n=!1,r="",o=pf;return t!=null&&(t.unstable_strictMode===!0&&(n=!0),t.identifierPrefix!==void 0&&(r=t.identifierPrefix),t.onRecoverableError!==void 0&&(o=t.onRecoverableError)),t=ra(e,1,!1,null,null,n,!1,r,o),e[Tt]=t.current,Fr(e.nodeType===8?e.parentNode:e),new la(t)};He.findDOMNode=function(e){if(e==null)return null;if(e.nodeType===1)return e;var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error(x(188)):(e=Object.keys(e).join(","),Error(x(268,e)));return e=$c(t),e=e===null?null:e.stateNode,e};He.flushSync=function(e){return hn(e)};He.hydrate=function(e,t,n){if(!Il(t))throw Error(x(200));return Ol(null,e,t,!0,n)};He.hydrateRoot=function(e,t,n){if(!ia(e))throw Error(x(405));var r=n!=null&&n.hydratedSources||null,o=!1,l="",i=pf;if(n!=null&&(n.unstable_strictMode===!0&&(o=!0),n.identifierPrefix!==void 0&&(l=n.identifierPrefix),n.onRecoverableError!==void 0&&(i=n.onRecoverableError)),t=_f(t,null,e,1,n??null,o,!1,l,i),e[Tt]=t.current,Fr(e),r)for(e=0;e<r.length;e++)n=r[e],o=n._getVersion,o=o(n._source),t.mutableSourceEagerHydrationData==null?t.mutableSourceEagerHydrationData=[n,o]:t.mutableSourceEagerHydrationData.push(n,o);return new Tl(t)};He.render=function(e,t,n){if(!Il(t))throw Error(x(200));return Ol(null,e,t,!1,n)};He.unmountComponentAtNode=function(e){if(!Il(e))throw Error(x(40));return e._reactRootContainer?(hn(function(){Ol(null,null,e,!1,function(){e._reactRootContainer=null,e[Tt]=null})}),!0):!1};He.unstable_batchedUpdates=qs;He.unstable_renderSubtreeIntoContainer=function(e,t,n,r){if(!Il(n))throw Error(x(200));if(e==null||e._reactInternals===void 0)throw Error(x(38));return Ol(e,t,n,!1,r)};He.version="18.3.1-next-f1338f8080-20240426"});var sa=St((np,yf)=>{"use strict";function hf(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(hf)}catch(e){console.error(e)}}hf(),yf.exports=mf()});var vf=St(aa=>{"use strict";var gf=sa();aa.createRoot=gf.createRoot,aa.hydrateRoot=gf.hydrateRoot;var rp});var xf=St(zl=>{"use strict";var w_=Ln(),C_=Symbol.for("react.element"),S_=Symbol.for("react.fragment"),E_=Object.prototype.hasOwnProperty,L_=w_.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,P_={key:!0,ref:!0,__self:!0,__source:!0};function kf(e,t,n){var r,o={},l=null,i=null;n!==void 0&&(l=""+n),t.key!==void 0&&(l=""+t.key),t.ref!==void 0&&(i=t.ref);for(r in t)E_.call(t,r)&&!P_.hasOwnProperty(r)&&(o[r]=t[r]);if(e&&e.defaultProps)for(r in t=e.defaultProps,t)o[r]===void 0&&(o[r]=t[r]);return{$$typeof:C_,type:e,key:l,ref:i,props:o,_owner:L_.current}}zl.Fragment=S_;zl.jsx=kf;zl.jsxs=kf});var $l=St((ip,wf)=>{"use strict";wf.exports=xf()});var Df=$t(Ln(),1),Rf=$t(vf(),1);var S=$t(Ln(),1),zf=$t(sa(),1),fe=$t(Ln(),1),ut=$t($l(),1),E=$t($l(),1),v=$t($l(),1),N_=`@keyframes styles-module__popupEnter___AuQDN {
  from {
    opacity: 0;
    transform: translateX(-50%) scale(0.95) translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) scale(1) translateY(0);
  }
}
@keyframes styles-module__popupExit___JJKQX {
  from {
    opacity: 1;
    transform: translateX(-50%) scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) scale(0.95) translateY(4px);
  }
}
@keyframes styles-module__shake___jdbWe {
  0%, 100% {
    transform: translateX(-50%) scale(1) translateY(0) translateX(0);
  }
  20% {
    transform: translateX(-50%) scale(1) translateY(0) translateX(-3px);
  }
  40% {
    transform: translateX(-50%) scale(1) translateY(0) translateX(3px);
  }
  60% {
    transform: translateX(-50%) scale(1) translateY(0) translateX(-2px);
  }
  80% {
    transform: translateX(-50%) scale(1) translateY(0) translateX(2px);
  }
}
.styles-module__popup___IhzrD {
  position: fixed;
  transform: translateX(-50%);
  width: 280px;
  padding: 0.75rem 1rem 14px;
  background: #1a1a1a;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.08);
  cursor: default;
  z-index: 100001;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  will-change: transform, opacity;
  contain: layout style;
  opacity: 0;
}
.styles-module__popup___IhzrD.styles-module__enter___L7U7N {
  animation: styles-module__popupEnter___AuQDN 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
.styles-module__popup___IhzrD.styles-module__entered___COX-w {
  opacity: 1;
  transform: translateX(-50%) scale(1) translateY(0);
}
.styles-module__popup___IhzrD.styles-module__exit___5eGjE {
  animation: styles-module__popupExit___JJKQX 0.15s ease-in forwards;
}
.styles-module__popup___IhzrD.styles-module__entered___COX-w.styles-module__shake___jdbWe {
  animation: styles-module__shake___jdbWe 0.25s ease-out;
}

.styles-module__header___wWsSi {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.styles-module__element___fTV2z {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.65);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.styles-module__timestamp___Dtpsv {
  font-size: 0.625rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.35);
  font-variant-numeric: tabular-nums;
  margin-left: 0.5rem;
  flex-shrink: 0;
}

.styles-module__quote___mcMmQ {
  font-size: 0.6875rem;
  font-style: italic;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 0.5rem;
  padding: 0.4rem 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.25rem;
  line-height: 1.45;
}

.styles-module__textarea___jrSae {
  width: 100%;
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  resize: none;
  outline: none;
  transition: border-color 0.15s ease;
}
.styles-module__textarea___jrSae:focus {
  border-color: #3c82f7;
}
.styles-module__textarea___jrSae.styles-module__green___99l3h:focus {
  border-color: #34C759;
}
.styles-module__textarea___jrSae::placeholder {
  color: rgba(255, 255, 255, 0.35);
}
.styles-module__textarea___jrSae::-webkit-scrollbar {
  width: 6px;
}
.styles-module__textarea___jrSae::-webkit-scrollbar-track {
  background: transparent;
}
.styles-module__textarea___jrSae::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.styles-module__actions___D6x3f {
  display: flex;
  justify-content: flex-end;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.styles-module__cancel___hRjnL,
.styles-module__submit___K-mIR {
  padding: 0.4rem 0.875rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 1rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}

.styles-module__cancel___hRjnL {
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
}
.styles-module__cancel___hRjnL:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.styles-module__submit___K-mIR {
  color: white;
}
.styles-module__submit___K-mIR:hover:not(:disabled) {
  filter: brightness(0.9);
}
.styles-module__submit___K-mIR:disabled {
  cursor: not-allowed;
}

.styles-module__light___6AaSQ.styles-module__popup___IhzrD {
  background: #fff;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.styles-module__light___6AaSQ .styles-module__element___fTV2z {
  color: rgba(0, 0, 0, 0.6);
}
.styles-module__light___6AaSQ .styles-module__timestamp___Dtpsv {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___6AaSQ .styles-module__quote___mcMmQ {
  color: rgba(0, 0, 0, 0.55);
  background: rgba(0, 0, 0, 0.04);
}
.styles-module__light___6AaSQ .styles-module__textarea___jrSae {
  background: rgba(0, 0, 0, 0.03);
  color: #1a1a1a;
  border-color: rgba(0, 0, 0, 0.12);
}
.styles-module__light___6AaSQ .styles-module__textarea___jrSae::placeholder {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___6AaSQ .styles-module__textarea___jrSae::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
}
.styles-module__light___6AaSQ .styles-module__cancel___hRjnL {
  color: rgba(0, 0, 0, 0.5);
}
.styles-module__light___6AaSQ .styles-module__cancel___hRjnL:hover {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.75);
}`,b_={popup:"styles-module__popup___IhzrD",enter:"styles-module__enter___L7U7N",popupEnter:"styles-module__popupEnter___AuQDN",entered:"styles-module__entered___COX-w",exit:"styles-module__exit___5eGjE",popupExit:"styles-module__popupExit___JJKQX",shake:"styles-module__shake___jdbWe",header:"styles-module__header___wWsSi",element:"styles-module__element___fTV2z",timestamp:"styles-module__timestamp___Dtpsv",quote:"styles-module__quote___mcMmQ",textarea:"styles-module__textarea___jrSae",green:"styles-module__green___99l3h",actions:"styles-module__actions___D6x3f",cancel:"styles-module__cancel___hRjnL",submit:"styles-module__submit___K-mIR",light:"styles-module__light___6AaSQ"};if(typeof document<"u"){let e=document.getElementById("feedback-tool-styles-annotation-popup-css-styles");e||(e=document.createElement("style"),e.id="feedback-tool-styles-annotation-popup-css-styles",e.textContent=N_,document.head.appendChild(e))}var je=b_,Cf=(0,fe.forwardRef)(function({element:t,timestamp:n,selectedText:r,placeholder:o="What should change?",initialValue:l="",submitLabel:i="Add",onSubmit:s,onCancel:a,style:d,accentColor:g="#3c82f7",isExiting:m=!1,lightMode:h=!1},w){let[C,L]=(0,fe.useState)(l),[J,u]=(0,fe.useState)(!1),[c,_]=(0,fe.useState)("initial"),[k,N]=(0,fe.useState)(!1),M=(0,fe.useRef)(null),T=(0,fe.useRef)(null);(0,fe.useEffect)(()=>{m&&c!=="exit"&&_("exit")},[m,c]),(0,fe.useEffect)(()=>{requestAnimationFrame(()=>{_("enter")});let Le=setTimeout(()=>{_("entered")},200),eo=setTimeout(()=>{let W=M.current;W&&(W.focus(),W.selectionStart=W.selectionEnd=W.value.length,W.scrollTop=W.scrollHeight)},50);return()=>{clearTimeout(Le),clearTimeout(eo)}},[]);let I=(0,fe.useCallback)(()=>{u(!0),setTimeout(()=>{u(!1),M.current?.focus()},250)},[]);(0,fe.useImperativeHandle)(w,()=>({shake:I}),[I]);let V=(0,fe.useCallback)(()=>{_("exit"),setTimeout(()=>{a()},150)},[a]),z=(0,fe.useCallback)(()=>{C.trim()&&s(C.trim())},[C,s]),Fe=(0,fe.useCallback)(Le=>{Le.key==="Enter"&&!Le.shiftKey&&(Le.preventDefault(),z()),Le.key==="Escape"&&V()},[z,V]),vn=[je.popup,h?je.light:"",c==="enter"?je.enter:"",c==="entered"?je.entered:"",c==="exit"?je.exit:"",J?je.shake:""].filter(Boolean).join(" ");return(0,ut.jsxs)("div",{ref:T,className:vn,"data-annotation-popup":!0,style:d,onClick:Le=>Le.stopPropagation(),children:[(0,ut.jsxs)("div",{className:je.header,children:[(0,ut.jsx)("span",{className:je.element,children:t}),n&&(0,ut.jsx)("span",{className:je.timestamp,children:n})]}),r&&(0,ut.jsxs)("div",{className:je.quote,children:["\u201C",r.slice(0,80),r.length>80?"...":"","\u201D"]}),(0,ut.jsx)("textarea",{ref:M,className:je.textarea,style:{borderColor:k?g:void 0},placeholder:o,value:C,onChange:Le=>L(Le.target.value),onFocus:()=>N(!0),onBlur:()=>N(!1),rows:2,onKeyDown:Fe}),(0,ut.jsxs)("div",{className:je.actions,children:[(0,ut.jsx)("button",{className:je.cancel,onClick:V,children:"Cancel"}),(0,ut.jsx)("button",{className:je.submit,style:{backgroundColor:g,opacity:C.trim()?1:.4},onClick:z,disabled:!C.trim(),children:i})]})]})}),Sf=({size:e=16})=>(0,E.jsx)("svg",{width:e,height:e,viewBox:"0 0 16 16",fill:"none",children:(0,E.jsx)("path",{d:"M4 4l8 8M12 4l-8 8",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})}),M_=({size:e=16})=>(0,E.jsx)("svg",{width:e,height:e,viewBox:"0 0 16 16",fill:"none",children:(0,E.jsx)("path",{d:"M8 3v10M3 8h10",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})});var T_=({size:e=24,style:t={}})=>(0,E.jsxs)("svg",{width:e,height:e,viewBox:"0 0 24 24",fill:"none",style:t,children:[(0,E.jsxs)("g",{clipPath:"url(#clip0_list_sparkle)",children:[(0,E.jsx)("path",{d:"M11.5 12L5.5 12",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),(0,E.jsx)("path",{d:"M18.5 6.75L5.5 6.75",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),(0,E.jsx)("path",{d:"M9.25 17.25L5.5 17.25",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),(0,E.jsx)("path",{d:"M16 12.75L16.5179 13.9677C16.8078 14.6494 17.3506 15.1922 18.0323 15.4821L19.25 16L18.0323 16.5179C17.3506 16.8078 16.8078 17.3506 16.5179 18.0323L16 19.25L15.4821 18.0323C15.1922 17.3506 14.6494 16.8078 13.9677 16.5179L12.75 16L13.9677 15.4821C14.6494 15.1922 15.1922 14.6494 15.4821 13.9677L16 12.75Z",stroke:"currentColor",strokeWidth:"1.5",strokeLinejoin:"round"})]}),(0,E.jsx)("defs",{children:(0,E.jsx)("clipPath",{id:"clip0_list_sparkle",children:(0,E.jsx)("rect",{width:"24",height:"24",fill:"white"})})})]}),Ef=({size:e=20})=>(0,E.jsxs)("svg",{width:e,height:e,viewBox:"0 0 20 20",fill:"none",children:[(0,E.jsx)("path",{d:"M10 16.0417C6.66328 16.0417 3.95834 13.3367 3.95834 10C3.95834 6.66328 6.66328 3.95833 10 3.95833C13.3367 3.95833 16.0417 6.66328 16.0417 10C16.0417 13.3367 13.3367 16.0417 10 16.0417Z",stroke:"currentColor",strokeOpacity:"0.2",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"}),(0,E.jsx)("path",{d:"M8.24188 8.18736C8.38392 7.78357 8.66429 7.44309 9.03331 7.22621C9.40234 7.00933 9.83621 6.93005 10.2581 7.00241C10.68 7.07477 11.0626 7.29411 11.3383 7.62157C11.6139 7.94903 11.7648 8.36348 11.7642 8.79152C11.7642 9.99986 10 10.604 10 10.604V10.8333",stroke:"currentColor",strokeOpacity:"0.2",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"}),(0,E.jsx)("path",{d:"M10 13.0208H10.006",stroke:"currentColor",strokeOpacity:"0.2",strokeWidth:"1.25",strokeLinecap:"round",strokeLinejoin:"round"})]}),Lf=({size:e=14})=>(0,E.jsxs)("svg",{width:e,height:e,viewBox:"0 0 14 14",fill:"none",children:[(0,E.jsx)("style",{children:`
      @keyframes checkDraw {
        0% {
          stroke-dashoffset: 12;
        }
        100% {
          stroke-dashoffset: 0;
        }
      }
      @keyframes checkBounce {
        0% {
          transform: scale(0.5);
          opacity: 0;
        }
        50% {
          transform: scale(1.12);
          opacity: 1;
        }
        75% {
          transform: scale(0.95);
        }
        100% {
          transform: scale(1);
        }
      }
      .check-path-animated {
        stroke-dasharray: 12;
        stroke-dashoffset: 0;
        transform-origin: center;
        animation: checkDraw 0.18s ease-out, checkBounce 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
    `}),(0,E.jsx)("path",{className:"check-path-animated",d:"M3.9375 7L6.125 9.1875L10.5 4.8125",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})]});var I_=({size:e=24,copied:t=!1})=>(0,E.jsxs)("svg",{width:e,height:e,viewBox:"0 0 24 24",fill:"none",children:[(0,E.jsx)("style",{children:`
      .copy-icon, .check-icon {
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
    `}),(0,E.jsxs)("g",{className:"copy-icon",style:{opacity:t?0:1,transform:t?"scale(0.8)":"scale(1)",transformOrigin:"center"},children:[(0,E.jsx)("path",{d:"M4.75 11.25C4.75 10.4216 5.42157 9.75 6.25 9.75H12.75C13.5784 9.75 14.25 10.4216 14.25 11.25V17.75C14.25 18.5784 13.5784 19.25 12.75 19.25H6.25C5.42157 19.25 4.75 18.5784 4.75 17.75V11.25Z",stroke:"currentColor",strokeWidth:"1.5"}),(0,E.jsx)("path",{d:"M17.25 14.25H17.75C18.5784 14.25 19.25 13.5784 19.25 12.75V6.25C19.25 5.42157 18.5784 4.75 17.75 4.75H11.25C10.4216 4.75 9.75 5.42157 9.75 6.25V6.75",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]}),(0,E.jsxs)("g",{className:"check-icon",style:{opacity:t?1:0,transform:t?"scale(1)":"scale(0.8)",transformOrigin:"center"},children:[(0,E.jsx)("path",{d:"M12 20C7.58172 20 4 16.4182 4 12C4 7.58172 7.58172 4 12 4C16.4182 4 20 7.58172 20 12C20 16.4182 16.4182 20 12 20Z",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),(0,E.jsx)("path",{d:"M15 10L11 14.25L9.25 12.25",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})]})]});var O_=({size:e=24,isOpen:t=!0})=>(0,E.jsxs)("svg",{width:e,height:e,viewBox:"0 0 24 24",fill:"none",children:[(0,E.jsx)("style",{children:`
      .eye-open, .eye-closed {
        transition: opacity 0.2s ease;
      }
    `}),(0,E.jsxs)("g",{className:"eye-open",style:{opacity:t?1:0},children:[(0,E.jsx)("path",{d:"M3.91752 12.7539C3.65127 12.2996 3.65037 11.7515 3.9149 11.2962C4.9042 9.59346 7.72688 5.49994 12 5.49994C16.2731 5.49994 19.0958 9.59346 20.0851 11.2962C20.3496 11.7515 20.3487 12.2996 20.0825 12.7539C19.0908 14.4459 16.2694 18.4999 12 18.4999C7.73064 18.4999 4.90918 14.4459 3.91752 12.7539Z",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),(0,E.jsx)("path",{d:"M12 14.8261C13.5608 14.8261 14.8261 13.5608 14.8261 12C14.8261 10.4392 13.5608 9.17392 12 9.17392C10.4392 9.17392 9.17391 10.4392 9.17391 12C9.17391 13.5608 10.4392 14.8261 12 14.8261Z",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})]}),(0,E.jsxs)("g",{className:"eye-closed",style:{opacity:t?0:1},children:[(0,E.jsx)("path",{d:"M18.6025 9.28503C18.9174 8.9701 19.4364 8.99481 19.7015 9.35271C20.1484 9.95606 20.4943 10.507 20.7342 10.9199C21.134 11.6086 21.1329 12.4454 20.7303 13.1328C20.2144 14.013 19.2151 15.5225 17.7723 16.8193C16.3293 18.1162 14.3852 19.2497 12.0008 19.25C11.4192 19.25 10.8638 19.1823 10.3355 19.0613C9.77966 18.934 9.63498 18.2525 10.0382 17.8493C10.2412 17.6463 10.5374 17.573 10.8188 17.6302C11.1993 17.7076 11.5935 17.75 12.0008 17.75C13.8848 17.7497 15.4867 16.8568 16.7693 15.7041C18.0522 14.5511 18.9606 13.1867 19.4363 12.375C19.5656 12.1543 19.5659 11.8943 19.4373 11.6729C19.2235 11.3049 18.921 10.8242 18.5364 10.3003C18.3085 9.98991 18.3302 9.5573 18.6025 9.28503ZM12.0008 4.75C12.5814 4.75006 13.1358 4.81803 13.6632 4.93953C14.2182 5.06741 14.362 5.74812 13.9593 6.15091C13.7558 6.35435 13.4589 6.42748 13.1771 6.36984C12.7983 6.29239 12.4061 6.25006 12.0008 6.25C10.1167 6.25 8.51415 7.15145 7.23028 8.31543C5.94678 9.47919 5.03918 10.8555 4.56426 11.6729C4.43551 11.8945 4.43582 12.1542 4.56524 12.375C4.77587 12.7343 5.07189 13.2012 5.44718 13.7105C5.67623 14.0213 5.65493 14.4552 5.38193 14.7282C5.0671 15.0431 4.54833 15.0189 4.28292 14.6614C3.84652 14.0736 3.50813 13.5369 3.27129 13.1328C2.86831 12.4451 2.86717 11.6088 3.26739 10.9199C3.78185 10.0345 4.77959 8.51239 6.22247 7.2041C7.66547 5.89584 9.61202 4.75 12.0008 4.75Z",fill:"currentColor"}),(0,E.jsx)("path",{d:"M5 19L19 5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]})]}),z_=({size:e=24,isPaused:t=!1})=>(0,E.jsxs)("svg",{width:e,height:e,viewBox:"0 0 24 24",fill:"none",children:[(0,E.jsx)("style",{children:`
      .pause-bar, .play-triangle {
        transition: opacity 0.15s ease;
      }
    `}),(0,E.jsx)("path",{className:"pause-bar",d:"M8 6L8 18",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",style:{opacity:t?0:1}}),(0,E.jsx)("path",{className:"pause-bar",d:"M16 18L16 6",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",style:{opacity:t?0:1}}),(0,E.jsx)("path",{className:"play-triangle",d:"M17.75 10.701C18.75 11.2783 18.75 12.7217 17.75 13.299L8.75 18.4952C7.75 19.0725 6.5 18.3509 6.5 17.1962L6.5 6.80384C6.5 5.64914 7.75 4.92746 8.75 5.50481L17.75 10.701Z",stroke:"currentColor",strokeWidth:"1.5",style:{opacity:t?1:0}})]});var $_=({size:e=16})=>(0,E.jsxs)("svg",{width:e,height:e,viewBox:"0 0 24 24",fill:"none",children:[(0,E.jsx)("path",{d:"M10.6504 5.81117C10.9939 4.39628 13.0061 4.39628 13.3496 5.81117C13.5715 6.72517 14.6187 7.15891 15.4219 6.66952C16.6652 5.91193 18.0881 7.33479 17.3305 8.57815C16.8411 9.38134 17.2748 10.4285 18.1888 10.6504C19.6037 10.9939 19.6037 13.0061 18.1888 13.3496C17.2748 13.5715 16.8411 14.6187 17.3305 15.4219C18.0881 16.6652 16.6652 18.0881 15.4219 17.3305C14.6187 16.8411 13.5715 17.2748 13.3496 18.1888C13.0061 19.6037 10.9939 19.6037 10.6504 18.1888C10.4285 17.2748 9.38135 16.8411 8.57815 17.3305C7.33479 18.0881 5.91193 16.6652 6.66952 15.4219C7.15891 14.6187 6.72517 13.5715 5.81117 13.3496C4.39628 13.0061 4.39628 10.9939 5.81117 10.6504C6.72517 10.4285 7.15891 9.38134 6.66952 8.57815C5.91193 7.33479 7.33479 5.91192 8.57815 6.66952C9.38135 7.15891 10.4285 6.72517 10.6504 5.81117Z",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),(0,E.jsx)("circle",{cx:"12",cy:"12",r:"2.5",stroke:"currentColor",strokeWidth:"1.5"})]});var D_=({size:e=16})=>(0,E.jsxs)("svg",{width:e,height:e,viewBox:"0 0 24 24",fill:"none",children:[(0,E.jsx)("path",{d:"M10 11.5L10.125 15.5",stroke:"currentColor",strokeOpacity:"1",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),(0,E.jsx)("path",{d:"M14 11.5L13.87 15.5",stroke:"currentColor",strokeOpacity:"1",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),(0,E.jsx)("path",{d:"M9 7.5V6.25C9 5.42157 9.67157 4.75 10.5 4.75H13.5C14.3284 4.75 15 5.42157 15 6.25V7.5",stroke:"currentColor",strokeOpacity:"1",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),(0,E.jsx)("path",{d:"M5.5 7.75H18.5",stroke:"currentColor",strokeOpacity:"1",strokeWidth:"1.5",strokeLinecap:"round"}),(0,E.jsx)("path",{d:"M6.75 7.75L7.11691 16.189C7.16369 17.2649 7.18708 17.8028 7.41136 18.2118C7.60875 18.5717 7.91211 18.8621 8.28026 19.0437C8.69854 19.25 9.23699 19.25 10.3139 19.25H13.6861C14.763 19.25 15.3015 19.25 15.7197 19.0437C16.0879 18.8621 16.3912 18.5717 16.5886 18.2118C16.8129 17.8028 16.8363 17.2649 16.8831 16.189L17.25 7.75",stroke:"currentColor",strokeOpacity:"1",strokeWidth:"1.5",strokeLinecap:"round"})]});var Pf=({size:e=16})=>(0,E.jsxs)("svg",{width:e,height:e,viewBox:"0 0 24 24",fill:"none",children:[(0,E.jsxs)("g",{clipPath:"url(#clip0_2_53)",children:[(0,E.jsx)("path",{d:"M16.25 16.25L7.75 7.75",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),(0,E.jsx)("path",{d:"M7.75 16.25L16.25 7.75",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})]}),(0,E.jsx)("defs",{children:(0,E.jsx)("clipPath",{id:"clip0_2_53",children:(0,E.jsx)("rect",{width:"24",height:"24",fill:"white"})})})]}),R_=({size:e=24})=>(0,E.jsxs)("svg",{width:e,height:e,viewBox:"0 0 24 24",fill:"none",children:[(0,E.jsxs)("g",{clipPath:"url(#clip0_1_660)",children:[(0,E.jsx)("path",{d:"M17.25 17.25L6.75 6.75",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"}),(0,E.jsx)("path",{d:"M6.75 17.25L17.25 6.75",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})]}),(0,E.jsx)("defs",{children:(0,E.jsx)("clipPath",{id:"clip0_1_660",children:(0,E.jsx)("rect",{width:"24",height:"24",fill:"white"})})})]}),j_=({size:e=16})=>(0,E.jsxs)("svg",{width:e,height:e,viewBox:"0 0 24 24",fill:"none",children:[(0,E.jsx)("circle",{cx:"12",cy:"12",r:"4",stroke:"currentColor",strokeWidth:"1.5"}),(0,E.jsx)("path",{d:"M12 5V3",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),(0,E.jsx)("path",{d:"M12 21V19",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),(0,E.jsx)("path",{d:"M16.95 7.05L18.36 5.64",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),(0,E.jsx)("path",{d:"M5.64 18.36L7.05 16.95",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),(0,E.jsx)("path",{d:"M19 12H21",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),(0,E.jsx)("path",{d:"M3 12H5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),(0,E.jsx)("path",{d:"M16.95 16.95L18.36 18.36",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"}),(0,E.jsx)("path",{d:"M5.64 5.64L7.05 7.05",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})]}),F_=({size:e=16})=>(0,E.jsx)("svg",{width:e,height:e,viewBox:"0 0 24 24",fill:"none",children:(0,E.jsx)("path",{d:"M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})});function A_(e,t=4){let n=[],r=e,o=0;for(;r&&o<t;){let l=r.tagName.toLowerCase();if(l==="html"||l==="body")break;let i=l;if(r.id)i=`#${r.id}`;else if(r.className&&typeof r.className=="string"){let s=r.className.split(/\s+/).find(a=>a.length>2&&!a.match(/^[a-z]{1,2}$/)&&!a.match(/[A-Z0-9]{5,}/));s&&(i=`.${s.split("_")[0]}`)}n.unshift(i),r=r.parentElement,o++}return n.join(" > ")}function qr(e){let t=A_(e);if(e.dataset.element)return{name:e.dataset.element,path:t};let n=e.tagName.toLowerCase();if(["path","circle","rect","line","g"].includes(n)){let r=e.closest("svg");if(r){let o=r.parentElement;if(o)return{name:`graphic in ${qr(o).name}`,path:t}}return{name:"graphic element",path:t}}if(n==="svg"){let r=e.parentElement;if(r?.tagName.toLowerCase()==="button"){let o=r.textContent?.trim();return{name:o?`icon in "${o}" button`:"button icon",path:t}}return{name:"icon",path:t}}if(n==="button"){let r=e.textContent?.trim(),o=e.getAttribute("aria-label");return o?{name:`button [${o}]`,path:t}:{name:r?`button "${r.slice(0,25)}"`:"button",path:t}}if(n==="a"){let r=e.textContent?.trim(),o=e.getAttribute("href");return r?{name:`link "${r.slice(0,25)}"`,path:t}:o?{name:`link to ${o.slice(0,30)}`,path:t}:{name:"link",path:t}}if(n==="input"){let r=e.getAttribute("type")||"text",o=e.getAttribute("placeholder"),l=e.getAttribute("name");return o?{name:`input "${o}"`,path:t}:l?{name:`input [${l}]`,path:t}:{name:`${r} input`,path:t}}if(["h1","h2","h3","h4","h5","h6"].includes(n)){let r=e.textContent?.trim();return{name:r?`${n} "${r.slice(0,35)}"`:n,path:t}}if(n==="p"){let r=e.textContent?.trim();return r?{name:`paragraph: "${r.slice(0,40)}${r.length>40?"...":""}"`,path:t}:{name:"paragraph",path:t}}if(n==="span"||n==="label"){let r=e.textContent?.trim();return r&&r.length<40?{name:`"${r}"`,path:t}:{name:n,path:t}}if(n==="li"){let r=e.textContent?.trim();return r&&r.length<40?{name:`list item: "${r.slice(0,35)}"`,path:t}:{name:"list item",path:t}}if(n==="blockquote")return{name:"blockquote",path:t};if(n==="code"){let r=e.textContent?.trim();return r&&r.length<30?{name:`code: \`${r}\``,path:t}:{name:"code",path:t}}if(n==="pre")return{name:"code block",path:t};if(n==="img"){let r=e.getAttribute("alt");return{name:r?`image "${r.slice(0,30)}"`:"image",path:t}}if(n==="video")return{name:"video",path:t};if(["div","section","article","nav","header","footer","aside","main"].includes(n)){let r=e.className,o=e.getAttribute("role"),l=e.getAttribute("aria-label");if(l)return{name:`${n} [${l}]`,path:t};if(o)return{name:`${o}`,path:t};if(typeof r=="string"&&r){let i=r.split(/[\s_-]+/).map(s=>s.replace(/[A-Z0-9]{5,}.*$/,"")).filter(s=>s.length>2&&!/^[a-z]{1,2}$/.test(s)).slice(0,2);if(i.length>0)return{name:i.join(" "),path:t}}return{name:n==="div"?"container":n,path:t}}return{name:n,path:t}}function ua(e){let t=[],n=e.textContent?.trim();n&&n.length<100&&t.push(n);let r=e.previousElementSibling;if(r){let l=r.textContent?.trim();l&&l.length<50&&t.unshift(`[before: "${l.slice(0,40)}"]`)}let o=e.nextElementSibling;if(o){let l=o.textContent?.trim();l&&l.length<50&&t.push(`[after: "${l.slice(0,40)}"]`)}return t.join(" ")}function Nf(e){let t=e.parentElement;if(!t)return"";let n=Array.from(t.children).filter(a=>a!==e&&a instanceof HTMLElement);if(n.length===0)return"";let r=n.slice(0,4).map(a=>{let d=a.tagName.toLowerCase(),g=a.className,m="";if(typeof g=="string"&&g){let h=g.split(/\s+/).map(w=>w.replace(/[_][a-zA-Z0-9]{5,}.*$/,"")).find(w=>w.length>2&&!/^[a-z]{1,2}$/.test(w));h&&(m=`.${h}`)}if(d==="button"||d==="a"){let h=a.textContent?.trim().slice(0,15);if(h)return`${d}${m} "${h}"`}return`${d}${m}`}),l=t.tagName.toLowerCase();if(typeof t.className=="string"&&t.className){let a=t.className.split(/\s+/).map(d=>d.replace(/[_][a-zA-Z0-9]{5,}.*$/,"")).find(d=>d.length>2&&!/^[a-z]{1,2}$/.test(d));a&&(l=`.${a}`)}let i=t.children.length,s=i>r.length+1?` (${i} total in ${l})`:"";return r.join(", ")+s}function ca(e){let t=e.className;return typeof t!="string"||!t?"":t.split(/\s+/).filter(r=>r.length>0).map(r=>{let o=r.match(/^([a-zA-Z][a-zA-Z0-9_-]*?)(?:_[a-zA-Z0-9]{5,})?$/);return o?o[1]:r}).filter((r,o,l)=>l.indexOf(r)===o).join(", ")}function bf(e){if(typeof window>"u")return{};let t=window.getComputedStyle(e),n={},r=["color","backgroundColor","borderColor","fontSize","fontWeight","fontFamily","lineHeight","letterSpacing","textAlign","width","height","padding","margin","border","borderRadius","display","position","top","right","bottom","left","zIndex","flexDirection","justifyContent","alignItems","gap","opacity","visibility","overflow","boxShadow","transform"];for(let o of r){let l=t.getPropertyValue(o.replace(/([A-Z])/g,"-$1").toLowerCase());l&&l!=="none"&&l!=="normal"&&l!=="auto"&&l!=="0px"&&l!=="rgba(0, 0, 0, 0)"&&(n[o]=l)}return n}function Mf(e){let t=[],n=e.getAttribute("role"),r=e.getAttribute("aria-label"),o=e.getAttribute("aria-describedby"),l=e.getAttribute("tabindex"),i=e.getAttribute("aria-hidden");return n&&t.push(`role="${n}"`),r&&t.push(`aria-label="${r}"`),o&&t.push(`aria-describedby="${o}"`),l&&t.push(`tabindex=${l}`),i==="true"&&t.push("aria-hidden"),e.matches("a, button, input, select, textarea, [tabindex]")&&t.push("focusable"),t.join(", ")}function Tf(e){let t=[],n=e;for(;n&&n.tagName.toLowerCase()!=="html";){let r=n.tagName.toLowerCase(),o=r;if(n.id)o=`${r}#${n.id}`;else if(n.className&&typeof n.className=="string"){let l=n.className.split(/\s+/).map(i=>i.replace(/[_][a-zA-Z0-9]{5,}.*$/,"")).find(i=>i.length>2);l&&(o=`${r}.${l}`)}t.unshift(o),n=n.parentElement}return t.join(" > ")}var Y_="feedback-annotations-",B_=7;function Dl(e){return`${Y_}${e}`}function W_(e){if(typeof window>"u")return[];try{let t=localStorage.getItem(Dl(e));if(!t)return[];let n=JSON.parse(t),r=Date.now()-B_*24*60*60*1e3;return n.filter(o=>!o.timestamp||o.timestamp>r)}catch{return[]}}function U_(e,t){if(!(typeof window>"u"))try{localStorage.setItem(Dl(e),JSON.stringify(t))}catch{}}var H_=`@keyframes styles-module__toolbarEnter___u8RRu {
  from {
    opacity: 0;
    transform: scale(0.5) rotate(90deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}
@keyframes styles-module__badgeEnter___mVQLj {
  from {
    opacity: 0;
    transform: scale(0);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes styles-module__scaleIn___c-r1K {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes styles-module__scaleOut___Wctwz {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.85);
  }
}
@keyframes styles-module__slideUp___kgD36 {
  from {
    opacity: 0;
    transform: scale(0.85) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
@keyframes styles-module__slideDown___zcdje {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.85) translateY(8px);
  }
}
@keyframes styles-module__markerIn___5FaAP {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.3);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
@keyframes styles-module__markerOut___GU5jX {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.3);
  }
}
@keyframes styles-module__fadeIn___b9qmf {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes styles-module__fadeOut___6Ut6- {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
@keyframes styles-module__tooltipIn___0N31w {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(2px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}
@keyframes styles-module__hoverHighlightIn___6WYHY {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes styles-module__hoverTooltipIn___FYGQx {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
@keyframes styles-module__settingsPanelIn___MGfO8 {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
    filter: blur(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0px);
  }
}
@keyframes styles-module__settingsPanelOut___Zfymi {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0px);
  }
  to {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
    filter: blur(5px);
  }
}
.styles-module__toolbar___wNsdK {
  position: fixed;
  bottom: 1.25rem;
  right: 1.25rem;
  width: 257px;
  z-index: 100000;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  pointer-events: none;
  transition: left 0s, top 0s, right 0s, bottom 0s;
}

.styles-module__toolbarContainer___dIhma {
  user-select: none;
  margin-left: auto;
  align-self: flex-end;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  color: #fff;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 0, 0, 0.1);
  pointer-events: auto;
  cursor: grab;
  transition: width 0.4s cubic-bezier(0.19, 1, 0.22, 1), transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
}
.styles-module__toolbarContainer___dIhma.styles-module__dragging___xrolZ {
  transition: width 0.4s cubic-bezier(0.19, 1, 0.22, 1);
  cursor: grabbing;
}
.styles-module__toolbarContainer___dIhma.styles-module__entrance___sgHd8 {
  animation: styles-module__toolbarEnter___u8RRu 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
}
.styles-module__toolbarContainer___dIhma.styles-module__collapsed___Rydsn {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  padding: 0;
  cursor: pointer;
}
.styles-module__toolbarContainer___dIhma.styles-module__collapsed___Rydsn svg {
  margin-top: -1px;
}
.styles-module__toolbarContainer___dIhma.styles-module__collapsed___Rydsn:hover {
  background: #2a2a2a;
}
.styles-module__toolbarContainer___dIhma.styles-module__collapsed___Rydsn:active {
  transform: scale(0.95);
}
.styles-module__toolbarContainer___dIhma.styles-module__expanded___ofKPx {
  width: calc-size(auto, size);
  height: 44px;
  border-radius: 1.5rem;
  padding: 0.375rem;
}
@supports not (width: calc-size(auto, size)) {
  .styles-module__toolbarContainer___dIhma.styles-module__expanded___ofKPx {
    width: 257px;
  }
}

.styles-module__toggleContent___0yfyP {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.1s cubic-bezier(0.19, 1, 0.22, 1);
}
.styles-module__toggleContent___0yfyP.styles-module__visible___KHwEW {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}
.styles-module__toggleContent___0yfyP.styles-module__hidden___Ae8H4 {
  opacity: 0;
  pointer-events: none;
}

.styles-module__controlsContent___9GJWU {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  transition: filter 0.8s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.8s cubic-bezier(0.19, 1, 0.22, 1), transform 0.6s cubic-bezier(0.19, 1, 0.22, 1);
}
.styles-module__controlsContent___9GJWU.styles-module__visible___KHwEW {
  opacity: 1;
  filter: blur(0px);
  transform: scale(1);
  visibility: visible;
  pointer-events: auto;
}
.styles-module__controlsContent___9GJWU.styles-module__hidden___Ae8H4 {
  opacity: 0;
  filter: blur(10px);
  transform: scale(0.4);
  pointer-events: none;
}

.styles-module__badge___2XsgF {
  position: absolute;
  top: -16px;
  right: -16px;
  user-select: none;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #3c82f7;
  color: white;
  font-size: 0.625rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  opacity: 1;
  transition: transform 0.3s ease, opacity 0.2s ease;
  transform: scale(1);
}
.styles-module__badge___2XsgF.styles-module__fadeOut___6Ut6- {
  opacity: 0;
  transform: scale(0);
  pointer-events: none;
}
.styles-module__badge___2XsgF.styles-module__entrance___sgHd8 {
  animation: styles-module__badgeEnter___mVQLj 0.3s cubic-bezier(0.34, 1.2, 0.64, 1) 0.4s both;
}

.styles-module__controlButton___8Q0jc {
  cursor: pointer !important;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease, opacity 0.2s ease;
}
.styles-module__controlButton___8Q0jc:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.styles-module__controlButton___8Q0jc:active:not(:disabled) {
  transform: scale(0.92);
}
.styles-module__controlButton___8Q0jc:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.styles-module__controlButton___8Q0jc[data-active=true] {
  color: #3c82f7;
  background: rgba(60, 130, 247, 0.25);
}
.styles-module__controlButton___8Q0jc[data-danger]:hover:not(:disabled) {
  background: rgba(255, 59, 48, 0.25);
  color: #ff3b30;
}

.styles-module__divider___c--s1 {
  width: 1px;
  height: 12px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 0.125rem;
}

.styles-module__overlay___Q1O9y {
  position: fixed;
  inset: 0;
  z-index: 99997;
  pointer-events: none;
}
.styles-module__overlay___Q1O9y > * {
  pointer-events: auto;
}

.styles-module__hoverHighlight___ogakW {
  position: fixed;
  border: 2px solid rgba(60, 130, 247, 0.5);
  border-radius: 4px;
  pointer-events: none !important;
  background: rgba(60, 130, 247, 0.04);
  box-sizing: border-box;
  will-change: opacity;
  contain: layout style;
}
.styles-module__hoverHighlight___ogakW.styles-module__enter___WFIki {
  animation: styles-module__hoverHighlightIn___6WYHY 0.12s ease-out forwards;
}

.styles-module__multiSelectOutline___cSJ-m {
  position: fixed;
  border: 2px dashed rgba(52, 199, 89, 0.6);
  border-radius: 4px;
  pointer-events: none !important;
  background: rgba(52, 199, 89, 0.05);
  box-sizing: border-box;
  will-change: opacity;
}
.styles-module__multiSelectOutline___cSJ-m.styles-module__enter___WFIki {
  animation: styles-module__fadeIn___b9qmf 0.15s ease-out forwards;
}
.styles-module__multiSelectOutline___cSJ-m.styles-module__exit___fyOJ0 {
  animation: styles-module__fadeOut___6Ut6- 0.15s ease-out forwards;
}

.styles-module__singleSelectOutline___QhX-O {
  position: fixed;
  border: 2px solid rgba(60, 130, 247, 0.6);
  border-radius: 4px;
  pointer-events: none !important;
  background: rgba(60, 130, 247, 0.05);
  box-sizing: border-box;
  will-change: opacity;
}
.styles-module__singleSelectOutline___QhX-O.styles-module__enter___WFIki {
  animation: styles-module__fadeIn___b9qmf 0.15s ease-out forwards;
}
.styles-module__singleSelectOutline___QhX-O.styles-module__exit___fyOJ0 {
  animation: styles-module__fadeOut___6Ut6- 0.15s ease-out forwards;
}

.styles-module__hoverTooltip___bvLk7 {
  position: fixed;
  font-size: 0.6875rem;
  font-weight: 500;
  color: #fff;
  background: rgba(0, 0, 0, 0.85);
  padding: 0.35rem 0.6rem;
  border-radius: 0.375rem;
  pointer-events: none !important;
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.styles-module__hoverTooltip___bvLk7.styles-module__enter___WFIki {
  animation: styles-module__hoverTooltipIn___FYGQx 0.1s ease-out forwards;
}

.styles-module__markersLayer___-25j1 {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 0;
  z-index: 99998;
  pointer-events: none;
}
.styles-module__markersLayer___-25j1 > * {
  pointer-events: auto;
}

.styles-module__fixedMarkersLayer___ffyX6 {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99998;
  pointer-events: none;
}
.styles-module__fixedMarkersLayer___ffyX6 > * {
  pointer-events: auto;
}

.styles-module__marker___6sQrs {
  position: absolute;
  width: 22px;
  height: 22px;
  background: #3c82f7;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  font-weight: 600;
  transform: translate(-50%, -50%) scale(1);
  opacity: 1;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  user-select: none;
  will-change: transform, opacity;
  contain: layout style;
  z-index: 1;
}
.styles-module__marker___6sQrs:hover {
  z-index: 2;
}
.styles-module__marker___6sQrs:not(.styles-module__enter___WFIki):not(.styles-module__exit___fyOJ0):not(.styles-module__clearing___FQ--7) {
  transition: background-color 0.15s ease, transform 0.1s ease;
}
.styles-module__marker___6sQrs.styles-module__enter___WFIki {
  animation: styles-module__markerIn___5FaAP 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.styles-module__marker___6sQrs.styles-module__exit___fyOJ0 {
  animation: styles-module__markerOut___GU5jX 0.2s ease-out both;
  pointer-events: none;
}
.styles-module__marker___6sQrs.styles-module__clearing___FQ--7 {
  animation: styles-module__markerOut___GU5jX 0.15s ease-out both;
  pointer-events: none;
}
.styles-module__marker___6sQrs:not(.styles-module__enter___WFIki):not(.styles-module__exit___fyOJ0):not(.styles-module__clearing___FQ--7):hover {
  transform: translate(-50%, -50%) scale(1.1);
}
.styles-module__marker___6sQrs.styles-module__pending___2IHLC {
  position: fixed;
  background: #3c82f7;
}
.styles-module__marker___6sQrs.styles-module__fixed___dBMHC {
  position: fixed;
}
.styles-module__marker___6sQrs.styles-module__multiSelect___YWiuz {
  background: #34c759;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  font-size: 0.75rem;
}
.styles-module__marker___6sQrs.styles-module__multiSelect___YWiuz.styles-module__pending___2IHLC {
  background: #34c759;
}
.styles-module__marker___6sQrs.styles-module__hovered___ZgXIy {
  background: #ff3b30;
}

.styles-module__renumber___nCTxD {
  display: block;
  animation: styles-module__renumberRoll___Wgbq3 0.2s ease-out;
}

@keyframes styles-module__renumberRoll___Wgbq3 {
  0% {
    transform: translateX(-40%);
    opacity: 0;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}
.styles-module__markerTooltip___aLJID {
  position: absolute;
  top: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 100002;
  background: #1a1a1a;
  padding: 0.625rem 0.75rem;
  border-radius: 0.75rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.08);
  min-width: 120px;
  max-width: 200px;
  pointer-events: none;
  cursor: default;
}
.styles-module__markerTooltip___aLJID.styles-module__enter___WFIki {
  animation: styles-module__tooltipIn___0N31w 0.1s ease-out forwards;
}

.styles-module__markerQuote___FHmrz {
  display: block;
  font-size: 0.6875rem;
  font-style: italic;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 0.375rem;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.styles-module__markerNote___QkrrS {
  display: block;
  font-size: 0.75rem;
  font-weight: 450;
  line-height: 1.4;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-bottom: 2px;
}

.styles-module__markerHint___2iF-6 {
  display: block;
  font-size: 0.625rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 0.375rem;
  white-space: nowrap;
}

.styles-module__settingsPanel___OxX3Y {
  position: absolute;
  right: 5px;
  bottom: calc(100% + 0.5rem);
  background: white;
  border-radius: 1rem;
  padding: 13px 1rem 16px;
  min-width: 205px;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.04);
  transition: background 0.25s ease, box-shadow 0.25s ease;
}
.styles-module__settingsPanel___OxX3Y .styles-module__settingsHeader___pwDY9,
.styles-module__settingsPanel___OxX3Y .styles-module__settingsBrand___0gJeM,
.styles-module__settingsPanel___OxX3Y .styles-module__settingsBrandSlash___uTG18,
.styles-module__settingsPanel___OxX3Y .styles-module__settingsVersion___TUcFq,
.styles-module__settingsPanel___OxX3Y .styles-module__settingsSection___m-YM2,
.styles-module__settingsPanel___OxX3Y .styles-module__settingsLabel___8UjfX,
.styles-module__settingsPanel___OxX3Y .styles-module__cycleButton___FMKfw,
.styles-module__settingsPanel___OxX3Y .styles-module__cycleDot___nPgLY,
.styles-module__settingsPanel___OxX3Y .styles-module__dropdownButton___16NPz,
.styles-module__settingsPanel___OxX3Y .styles-module__toggleLabel___Xm8Aa,
.styles-module__settingsPanel___OxX3Y .styles-module__customCheckbox___U39ax,
.styles-module__settingsPanel___OxX3Y .styles-module__sliderLabel___U8sPr,
.styles-module__settingsPanel___OxX3Y .styles-module__slider___GLdxp,
.styles-module__settingsPanel___OxX3Y .styles-module__helpIcon___xQg56,
.styles-module__settingsPanel___OxX3Y .styles-module__themeToggle___2rUjA {
  transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease;
}
.styles-module__settingsPanel___OxX3Y.styles-module__enter___WFIki {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0px);
  transition: opacity 0.2s ease, transform 0.2s ease, filter 0.2s ease;
}
.styles-module__settingsPanel___OxX3Y.styles-module__exit___fyOJ0 {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
  filter: blur(5px);
  pointer-events: none;
  transition: opacity 0.1s ease, transform 0.1s ease, filter 0.1s ease;
}
.styles-module__settingsPanel___OxX3Y.styles-module__dark___ILIQf {
  background: #1a1a1a;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.08);
}
.styles-module__settingsPanel___OxX3Y.styles-module__dark___ILIQf .styles-module__settingsLabel___8UjfX {
  color: rgba(255, 255, 255, 0.6);
}
.styles-module__settingsPanel___OxX3Y.styles-module__dark___ILIQf .styles-module__settingsOption___UNa12 {
  color: rgba(255, 255, 255, 0.85);
}
.styles-module__settingsPanel___OxX3Y.styles-module__dark___ILIQf .styles-module__settingsOption___UNa12:hover {
  background: rgba(255, 255, 255, 0.1);
}
.styles-module__settingsPanel___OxX3Y.styles-module__dark___ILIQf .styles-module__settingsOption___UNa12.styles-module__selected___OwRqP {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}
.styles-module__settingsPanel___OxX3Y.styles-module__dark___ILIQf .styles-module__toggleLabel___Xm8Aa {
  color: rgba(255, 255, 255, 0.85);
}

.styles-module__settingsHeader___pwDY9 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  margin-bottom: 0.5rem;
  padding-bottom: 9px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.styles-module__settingsBrand___0gJeM {
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.0094em;
  color: #fff;
}

.styles-module__settingsBrandSlash___uTG18 {
  color: rgba(255, 255, 255, 0.5);
}

.styles-module__settingsVersion___TUcFq {
  font-size: 0.6875rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.4);
  margin-left: auto;
  letter-spacing: -0.0094em;
}

.styles-module__settingsSection___m-YM2 + .styles-module__settingsSection___m-YM2 {
  margin-top: 0.5rem;
  padding-top: calc(0.5rem + 2px);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.styles-module__settingsRow___3sdhc {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
}

.styles-module__dropdownContainer___BVnxe {
  position: relative;
}

.styles-module__dropdownButton___16NPz {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  letter-spacing: -0.0094em;
}
.styles-module__dropdownButton___16NPz:hover {
  background: rgba(255, 255, 255, 0.08);
}
.styles-module__dropdownButton___16NPz svg {
  opacity: 0.6;
}

.styles-module__cycleButton___FMKfw {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
  letter-spacing: -0.0094em;
}
.styles-module__cycleButton___FMKfw.styles-module__light___r6n4Y {
  color: rgba(0, 0, 0, 0.85);
}

@keyframes styles-module__cycleTextIn___Q6zJf {
  0% {
    opacity: 0;
    transform: translateY(-6px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
.styles-module__cycleButtonText___fD1LR {
  display: inline-block;
  animation: styles-module__cycleTextIn___Q6zJf 0.2s ease-out;
}

.styles-module__cycleDots___LWuoQ {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.styles-module__cycleDot___nPgLY {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: scale(0.667);
  transition: background-color 0.25s ease-out, transform 0.25s ease-out;
}
.styles-module__cycleDot___nPgLY.styles-module__active___-zoN6 {
  background: #fff;
  transform: scale(1);
}
.styles-module__cycleDot___nPgLY.styles-module__light___r6n4Y {
  background: rgba(0, 0, 0, 0.2);
}
.styles-module__cycleDot___nPgLY.styles-module__light___r6n4Y.styles-module__active___-zoN6 {
  background: rgba(0, 0, 0, 0.7);
}

.styles-module__dropdownMenu___k73ER {
  position: absolute;
  right: 0;
  top: calc(100% + 0.25rem);
  background: #1a1a1a;
  border-radius: 0.5rem;
  padding: 0.25rem;
  min-width: 120px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
  z-index: 10;
  animation: styles-module__scaleIn___c-r1K 0.15s ease-out;
}

.styles-module__dropdownItem___ylsLj {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease, color 0.15s ease;
  letter-spacing: -0.0094em;
}
.styles-module__dropdownItem___ylsLj:hover {
  background: rgba(255, 255, 255, 0.08);
}
.styles-module__dropdownItem___ylsLj.styles-module__selected___OwRqP {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-weight: 600;
}

.styles-module__settingsLabel___8UjfX {
  font-size: 0.8125rem;
  font-weight: 400;
  letter-spacing: -0.0094em;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  gap: 0.125rem;
}
.styles-module__settingsLabel___8UjfX.styles-module__light___r6n4Y {
  color: rgba(0, 0, 0, 0.5);
}

.styles-module__settingsLabelMarker___ewdtV {
  margin-bottom: 10px;
}

.styles-module__settingsOptions___LyrBA {
  display: flex;
  gap: 0.25rem;
}

.styles-module__settingsOption___UNa12 {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  font-size: 0.6875rem;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.7);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.styles-module__settingsOption___UNa12:hover {
  background: rgba(0, 0, 0, 0.05);
}
.styles-module__settingsOption___UNa12.styles-module__selected___OwRqP {
  background: rgba(60, 130, 247, 0.15);
  color: #3c82f7;
}

.styles-module__sliderContainer___ducXj {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.styles-module__slider___GLdxp {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.styles-module__slider___GLdxp::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.styles-module__slider___GLdxp::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.styles-module__slider___GLdxp:hover::-webkit-slider-thumb {
  transform: scale(1.15);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}
.styles-module__slider___GLdxp:hover::-moz-range-thumb {
  transform: scale(1.15);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.styles-module__sliderLabels___FhLDB {
  display: flex;
  justify-content: space-between;
}

.styles-module__sliderLabel___U8sPr {
  font-size: 0.625rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: color 0.15s ease;
}
.styles-module__sliderLabel___U8sPr:hover {
  color: rgba(255, 255, 255, 0.7);
}
.styles-module__sliderLabel___U8sPr.styles-module__active___-zoN6 {
  color: rgba(255, 255, 255, 0.9);
}

.styles-module__colorOptions___iHCNX {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.375rem;
  margin-bottom: 1px;
}

.styles-module__colorOption___IodiY {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}
.styles-module__colorOption___IodiY:hover {
  transform: scale(1.15);
}
.styles-module__colorOption___IodiY.styles-module__selected___OwRqP {
  transform: scale(0.83);
}

.styles-module__colorOptionRing___U2xpo {
  display: flex;
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: 50%;
  transition: border-color 0.3s ease;
}
.styles-module__settingsToggle___fBrFn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}
.styles-module__settingsToggle___fBrFn + .styles-module__settingsToggle___fBrFn {
  margin-top: calc(0.5rem + 6px);
}
.styles-module__settingsToggle___fBrFn input[type=checkbox] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.styles-module__customCheckbox___U39ax {
  position: relative;
  width: 14px;
  height: 14px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.25s ease, border-color 0.25s ease;
}
.styles-module__customCheckbox___U39ax svg {
  color: #1a1a1a;
  opacity: 1;
  transition: opacity 0.15s ease;
}
input[type=checkbox]:checked + .styles-module__customCheckbox___U39ax {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgb(255, 255, 255);
}
.styles-module__customCheckbox___U39ax.styles-module__light___r6n4Y {
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #fff;
}
.styles-module__customCheckbox___U39ax.styles-module__light___r6n4Y.styles-module__checked___mnZLo {
  border-color: #1a1a1a;
  background: #1a1a1a;
}
.styles-module__customCheckbox___U39ax.styles-module__light___r6n4Y.styles-module__checked___mnZLo svg {
  color: #fff;
}

.styles-module__toggleLabel___Xm8Aa {
  font-size: 0.8125rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: -0.0094em;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.styles-module__toggleLabel___Xm8Aa.styles-module__light___r6n4Y {
  color: rgba(0, 0, 0, 0.5);
}

.styles-module__helpIcon___xQg56 {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  margin-left: 0;
}
.styles-module__helpIcon___xQg56 svg {
  display: block;
  transform: translateY(1px);
  color: rgba(255, 255, 255, 0.4);
  transition: color 0.15s ease;
}
.styles-module__helpIcon___xQg56:hover svg {
  color: rgba(255, 255, 255, 0.7);
}
.styles-module__helpIcon___xQg56::after {
  content: attr(data-tooltip);
  position: absolute;
  right: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  padding: 8px 10px;
  background: #383838;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  border-radius: 10px;
  white-space: normal;
  width: 152px;
  text-align: left;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, visibility 0.15s ease;
  pointer-events: none;
  z-index: 100;
  box-shadow: 0px 1px 8px rgba(0, 0, 0, 0.28);
}
.styles-module__helpIcon___xQg56:hover::after {
  opacity: 1;
  visibility: visible;
  transition-delay: 0.5s;
}

.styles-module__dragSelection___kZLq2 {
  position: fixed;
  top: 0;
  left: 0;
  border: 2px solid rgba(52, 199, 89, 0.6);
  border-radius: 4px;
  background: rgba(52, 199, 89, 0.08);
  pointer-events: none;
  z-index: 99997;
  will-change: transform, width, height;
  contain: layout style;
}

.styles-module__dragCount___KM90j {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #34c759;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 1rem;
  min-width: 1.5rem;
  text-align: center;
}

.styles-module__highlightsContainer___-0xzG {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 99996;
}

.styles-module__selectedElementHighlight___fyVlI {
  position: fixed;
  top: 0;
  left: 0;
  border: 2px solid rgba(52, 199, 89, 0.5);
  border-radius: 4px;
  background: rgba(52, 199, 89, 0.06);
  pointer-events: none;
  will-change: transform, width, height;
  contain: layout style;
}

.styles-module__light___r6n4Y.styles-module__toolbarContainer___dIhma {
  background: #fff;
  color: rgba(0, 0, 0, 0.85);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04);
}
.styles-module__light___r6n4Y.styles-module__toolbarContainer___dIhma.styles-module__collapsed___Rydsn:hover {
  background: #f5f5f5;
}
.styles-module__light___r6n4Y.styles-module__controlButton___8Q0jc {
  color: rgba(0, 0, 0, 0.5);
}
.styles-module__light___r6n4Y.styles-module__controlButton___8Q0jc:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.85);
}
.styles-module__light___r6n4Y.styles-module__controlButton___8Q0jc[data-active=true] {
  color: #3c82f7;
  background: rgba(60, 130, 247, 0.15);
}
.styles-module__light___r6n4Y.styles-module__controlButton___8Q0jc[data-danger]:hover:not(:disabled) {
  background: rgba(255, 59, 48, 0.15);
  color: #ff3b30;
}
.styles-module__light___r6n4Y.styles-module__divider___c--s1 {
  background: rgba(0, 0, 0, 0.1);
}
.styles-module__light___r6n4Y.styles-module__markerTooltip___aLJID {
  background: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.styles-module__light___r6n4Y.styles-module__markerTooltip___aLJID .styles-module__markerQuote___FHmrz {
  color: rgba(0, 0, 0, 0.5);
}
.styles-module__light___r6n4Y.styles-module__markerTooltip___aLJID .styles-module__markerNote___QkrrS {
  color: rgba(0, 0, 0, 0.85);
}
.styles-module__light___r6n4Y.styles-module__markerTooltip___aLJID .styles-module__markerHint___2iF-6 {
  color: rgba(0, 0, 0, 0.35);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__settingsHeader___pwDY9 {
  border-bottom-color: rgba(0, 0, 0, 0.08);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__settingsBrand___0gJeM {
  color: rgba(0, 0, 0, 0.85);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__settingsBrandSlash___uTG18 {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__settingsVersion___TUcFq {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__settingsSection___m-YM2 {
  border-top-color: rgba(0, 0, 0, 0.08);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__settingsLabel___8UjfX {
  color: rgba(0, 0, 0, 0.5);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__cycleButton___FMKfw {
  color: rgba(0, 0, 0, 0.85);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__cycleDot___nPgLY {
  background: rgba(0, 0, 0, 0.2);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__cycleDot___nPgLY.styles-module__active___-zoN6 {
  background: rgba(0, 0, 0, 0.7);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__dropdownButton___16NPz {
  color: rgba(0, 0, 0, 0.85);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__dropdownButton___16NPz:hover {
  background: rgba(0, 0, 0, 0.05);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__toggleLabel___Xm8Aa {
  color: rgba(0, 0, 0, 0.5);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__customCheckbox___U39ax {
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #fff;
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__customCheckbox___U39ax.styles-module__checked___mnZLo {
  border-color: #1a1a1a;
  background: #1a1a1a;
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__customCheckbox___U39ax.styles-module__checked___mnZLo svg {
  color: #fff;
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__sliderLabel___U8sPr {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__sliderLabel___U8sPr:hover {
  color: rgba(0, 0, 0, 0.7);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__sliderLabel___U8sPr.styles-module__active___-zoN6 {
  color: rgba(0, 0, 0, 0.9);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__slider___GLdxp {
  background: rgba(0, 0, 0, 0.1);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__slider___GLdxp::-webkit-slider-thumb {
  background: #1a1a1a;
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__slider___GLdxp::-moz-range-thumb {
  background: #1a1a1a;
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__helpIcon___xQg56 svg {
  color: rgba(0, 0, 0, 0.6);
}
.styles-module__light___r6n4Y.styles-module__settingsPanel___OxX3Y .styles-module__helpIcon___xQg56:hover svg {
  color: rgba(0, 0, 0, 0.7);
}

.styles-module__themeToggle___2rUjA {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-left: 0.5rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.styles-module__themeToggle___2rUjA:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}
.styles-module__light___r6n4Y .styles-module__themeToggle___2rUjA {
  color: rgba(0, 0, 0, 0.4);
}
.styles-module__light___r6n4Y .styles-module__themeToggle___2rUjA:hover {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.7);
}`,X_={toolbar:"styles-module__toolbar___wNsdK",toolbarContainer:"styles-module__toolbarContainer___dIhma",dragging:"styles-module__dragging___xrolZ",entrance:"styles-module__entrance___sgHd8",toolbarEnter:"styles-module__toolbarEnter___u8RRu",collapsed:"styles-module__collapsed___Rydsn",expanded:"styles-module__expanded___ofKPx",toggleContent:"styles-module__toggleContent___0yfyP",visible:"styles-module__visible___KHwEW",hidden:"styles-module__hidden___Ae8H4",controlsContent:"styles-module__controlsContent___9GJWU",badge:"styles-module__badge___2XsgF",fadeOut:"styles-module__fadeOut___6Ut6-",badgeEnter:"styles-module__badgeEnter___mVQLj",controlButton:"styles-module__controlButton___8Q0jc",divider:"styles-module__divider___c--s1",overlay:"styles-module__overlay___Q1O9y",hoverHighlight:"styles-module__hoverHighlight___ogakW",enter:"styles-module__enter___WFIki",hoverHighlightIn:"styles-module__hoverHighlightIn___6WYHY",multiSelectOutline:"styles-module__multiSelectOutline___cSJ-m",fadeIn:"styles-module__fadeIn___b9qmf",exit:"styles-module__exit___fyOJ0",singleSelectOutline:"styles-module__singleSelectOutline___QhX-O",hoverTooltip:"styles-module__hoverTooltip___bvLk7",hoverTooltipIn:"styles-module__hoverTooltipIn___FYGQx",markersLayer:"styles-module__markersLayer___-25j1",fixedMarkersLayer:"styles-module__fixedMarkersLayer___ffyX6",marker:"styles-module__marker___6sQrs",clearing:"styles-module__clearing___FQ--7",markerIn:"styles-module__markerIn___5FaAP",markerOut:"styles-module__markerOut___GU5jX",pending:"styles-module__pending___2IHLC",fixed:"styles-module__fixed___dBMHC",multiSelect:"styles-module__multiSelect___YWiuz",hovered:"styles-module__hovered___ZgXIy",renumber:"styles-module__renumber___nCTxD",renumberRoll:"styles-module__renumberRoll___Wgbq3",markerTooltip:"styles-module__markerTooltip___aLJID",tooltipIn:"styles-module__tooltipIn___0N31w",markerQuote:"styles-module__markerQuote___FHmrz",markerNote:"styles-module__markerNote___QkrrS",markerHint:"styles-module__markerHint___2iF-6",settingsPanel:"styles-module__settingsPanel___OxX3Y",settingsHeader:"styles-module__settingsHeader___pwDY9",settingsBrand:"styles-module__settingsBrand___0gJeM",settingsBrandSlash:"styles-module__settingsBrandSlash___uTG18",settingsVersion:"styles-module__settingsVersion___TUcFq",settingsSection:"styles-module__settingsSection___m-YM2",settingsLabel:"styles-module__settingsLabel___8UjfX",cycleButton:"styles-module__cycleButton___FMKfw",cycleDot:"styles-module__cycleDot___nPgLY",dropdownButton:"styles-module__dropdownButton___16NPz",toggleLabel:"styles-module__toggleLabel___Xm8Aa",customCheckbox:"styles-module__customCheckbox___U39ax",sliderLabel:"styles-module__sliderLabel___U8sPr",slider:"styles-module__slider___GLdxp",helpIcon:"styles-module__helpIcon___xQg56",themeToggle:"styles-module__themeToggle___2rUjA",dark:"styles-module__dark___ILIQf",settingsOption:"styles-module__settingsOption___UNa12",selected:"styles-module__selected___OwRqP",settingsRow:"styles-module__settingsRow___3sdhc",dropdownContainer:"styles-module__dropdownContainer___BVnxe",light:"styles-module__light___r6n4Y",cycleButtonText:"styles-module__cycleButtonText___fD1LR",cycleTextIn:"styles-module__cycleTextIn___Q6zJf",cycleDots:"styles-module__cycleDots___LWuoQ",active:"styles-module__active___-zoN6",dropdownMenu:"styles-module__dropdownMenu___k73ER",scaleIn:"styles-module__scaleIn___c-r1K",dropdownItem:"styles-module__dropdownItem___ylsLj",settingsLabelMarker:"styles-module__settingsLabelMarker___ewdtV",settingsOptions:"styles-module__settingsOptions___LyrBA",sliderContainer:"styles-module__sliderContainer___ducXj",sliderLabels:"styles-module__sliderLabels___FhLDB",colorOptions:"styles-module__colorOptions___iHCNX",colorOption:"styles-module__colorOption___IodiY",colorOptionRing:"styles-module__colorOptionRing___U2xpo",settingsToggle:"styles-module__settingsToggle___fBrFn",checked:"styles-module__checked___mnZLo",dragSelection:"styles-module__dragSelection___kZLq2",dragCount:"styles-module__dragCount___KM90j",highlightsContainer:"styles-module__highlightsContainer___-0xzG",selectedElementHighlight:"styles-module__selectedElementHighlight___fyVlI",scaleOut:"styles-module__scaleOut___Wctwz",slideUp:"styles-module__slideUp___kgD36",slideDown:"styles-module__slideDown___zcdje",settingsPanelIn:"styles-module__settingsPanelIn___MGfO8",settingsPanelOut:"styles-module__settingsPanelOut___Zfymi"};if(typeof document<"u"){let e=document.getElementById("feedback-tool-styles-page-toolbar-css-styles");e||(e=document.createElement("style"),e.id="feedback-tool-styles-page-toolbar-css-styles",e.textContent=H_,document.head.appendChild(e))}var p=X_,If=!1,Of={outputDetail:"standard",autoClearAfterCopy:!1,annotationColor:"#3c82f7",blockInteractions:!1},Jr=[{value:"compact",label:"Compact"},{value:"standard",label:"Standard"},{value:"detailed",label:"Detailed"},{value:"forensic",label:"Forensic"}],Q_=[{value:"#AF52DE",label:"Purple"},{value:"#3c82f7",label:"Blue"},{value:"#5AC8FA",label:"Cyan"},{value:"#34C759",label:"Green"},{value:"#FFD60A",label:"Yellow"},{value:"#FF9500",label:"Orange"},{value:"#FF3B30",label:"Red"}];function V_(e){let t=e;for(;t&&t!==document.body;){let r=window.getComputedStyle(t).position;if(r==="fixed"||r==="sticky")return!0;t=t.parentElement}return!1}function Z_(e,t,n="standard"){if(e.length===0)return"";let r=typeof window<"u"?`${window.innerWidth}\xD7${window.innerHeight}`:"unknown",o=`## Page Feedback: ${t}
`;return n==="forensic"?(o+=`
**Environment:**
`,o+=`- Viewport: ${r}
`,typeof window<"u"&&(o+=`- URL: ${window.location.href}
`,o+=`- User Agent: ${navigator.userAgent}
`,o+=`- Timestamp: ${new Date().toISOString()}
`,o+=`- Device Pixel Ratio: ${window.devicePixelRatio}
`),o+=`
---
`):n!=="compact"&&(o+=`**Viewport:** ${r}
`),o+=`
`,e.forEach((l,i)=>{n==="compact"?(o+=`${i+1}. **${l.element}**: ${l.comment}`,l.selectedText&&(o+=` (re: "${l.selectedText.slice(0,30)}${l.selectedText.length>30?"...":""}")`),o+=`
`):n==="forensic"?(o+=`### ${i+1}. ${l.element}
`,l.isMultiSelect&&l.fullPath&&(o+=`*Forensic data shown for first element of selection*
`),l.fullPath&&(o+=`**Full DOM Path:** ${l.fullPath}
`),l.cssClasses&&(o+=`**CSS Classes:** ${l.cssClasses}
`),l.boundingBox&&(o+=`**Position:** x:${Math.round(l.boundingBox.x)}, y:${Math.round(l.boundingBox.y)} (${Math.round(l.boundingBox.width)}\xD7${Math.round(l.boundingBox.height)}px)
`),o+=`**Annotation at:** ${l.x.toFixed(1)}% from left, ${Math.round(l.y)}px from top
`,l.selectedText&&(o+=`**Selected text:** "${l.selectedText}"
`),l.nearbyText&&!l.selectedText&&(o+=`**Context:** ${l.nearbyText.slice(0,100)}
`),l.computedStyles&&(o+=`**Computed Styles:** ${l.computedStyles}
`),l.accessibility&&(o+=`**Accessibility:** ${l.accessibility}
`),l.nearbyElements&&(o+=`**Nearby Elements:** ${l.nearbyElements}
`),o+=`**Feedback:** ${l.comment}

`):(o+=`### ${i+1}. ${l.element}
`,o+=`**Location:** ${l.elementPath}
`,n==="detailed"&&(l.cssClasses&&(o+=`**Classes:** ${l.cssClasses}
`),l.boundingBox&&(o+=`**Position:** ${Math.round(l.boundingBox.x)}px, ${Math.round(l.boundingBox.y)}px (${Math.round(l.boundingBox.width)}\xD7${Math.round(l.boundingBox.height)}px)
`)),l.selectedText&&(o+=`**Selected text:** "${l.selectedText}"
`),n==="detailed"&&l.nearbyText&&!l.selectedText&&(o+=`**Context:** ${l.nearbyText.slice(0,100)}
`),o+=`**Feedback:** ${l.comment}

`)}),o.trim()}function $f({demoAnnotations:e,demoDelay:t=1e3,enableDemoMode:n=!1}={}){let[r,o]=(0,S.useState)(!1),[l,i]=(0,S.useState)([]),[s,a]=(0,S.useState)(!0),[d,g]=(0,S.useState)(!1),[m,h]=(0,S.useState)(!1),[w,C]=(0,S.useState)(null),[L,J]=(0,S.useState)({x:0,y:0}),[u,c]=(0,S.useState)(null),[_,k]=(0,S.useState)(!1),[N,M]=(0,S.useState)(!1),[T,I]=(0,S.useState)(!1),[V,z]=(0,S.useState)(null),[Fe,vn]=(0,S.useState)(null),[Le,eo]=(0,S.useState)(null),[W,to]=(0,S.useState)(null),[no,fa]=(0,S.useState)(0),[_a,pa]=(0,S.useState)(!1),[ct,jf]=(0,S.useState)(!1),[et,ma]=(0,S.useState)(!1),[Rl,ha]=(0,S.useState)(!1),[Ff,ya]=(0,S.useState)(!1),[D,nr]=(0,S.useState)(Of),[re,ga]=(0,S.useState)(!0),[va,ka]=(0,S.useState)(!1),[Ie,xa]=(0,S.useState)(null),[kn,wa]=(0,S.useState)(!1),[xn,Ca]=(0,S.useState)(null),[Af,Yf]=(0,S.useState)(0),jl=(0,S.useRef)(!1),[Sa,ro]=(0,S.useState)(new Set),[Ea,La]=(0,S.useState)(new Set),[Fl,oo]=(0,S.useState)(!1),[Bf,lo]=(0,S.useState)(!1),[kt,Pa]=(0,S.useState)(!1),wn=(0,S.useRef)(null),dt=(0,S.useRef)(null),rr=(0,S.useRef)(null),or=(0,S.useRef)(null),io=(0,S.useRef)(!1),Na=(0,S.useRef)(0),so=(0,S.useRef)(null),Al=8,Wf=50,ba=(0,S.useRef)(null),Ma=(0,S.useRef)(null),lr=(0,S.useRef)(null),xt=typeof window<"u"?window.location.pathname:"/";(0,S.useEffect)(()=>{if(Rl)ya(!0);else{let f=setTimeout(()=>ya(!1),0);return()=>clearTimeout(f)}},[Rl]);let Ta=r&&s;(0,S.useEffect)(()=>{if(Ta){h(!1),g(!0),ro(new Set);let f=setTimeout(()=>{ro(y=>{let b=new Set(y);return l.forEach(R=>b.add(R.id)),b})},350);return()=>clearTimeout(f)}else if(d){h(!0);let f=setTimeout(()=>{g(!1),h(!1)},250);return()=>clearTimeout(f)}},[Ta]),(0,S.useEffect)(()=>{jf(!0),fa(window.scrollY);let f=W_(xt);i(f),If||(ka(!0),If=!0,setTimeout(()=>ka(!1),750));try{let y=localStorage.getItem("feedback-toolbar-settings");y&&nr({...Of,...JSON.parse(y)})}catch{}try{let y=localStorage.getItem("feedback-toolbar-theme");y!==null&&ga(y==="dark")}catch{}},[xt]),(0,S.useEffect)(()=>{ct&&localStorage.setItem("feedback-toolbar-settings",JSON.stringify(D))},[D,ct]),(0,S.useEffect)(()=>{ct&&localStorage.setItem("feedback-toolbar-theme",re?"dark":"light")},[re,ct]),(0,S.useEffect)(()=>{if(!n||!ct||!e||e.length===0||l.length>0)return;let f=[];return f.push(setTimeout(()=>{o(!0)},t-200)),e.forEach((y,b)=>{let R=t+b*300;f.push(setTimeout(()=>{let $=document.querySelector(y.selector);if(!$)return;let O=$.getBoundingClientRect(),{name:q,path:H}=qr($),ue={id:`demo-${Date.now()}-${b}`,x:(O.left+O.width/2)/window.innerWidth*100,y:O.top+O.height/2+window.scrollY,comment:y.comment,element:q,elementPath:H,timestamp:Date.now(),selectedText:y.selectedText,boundingBox:{x:O.left,y:O.top+window.scrollY,width:O.width,height:O.height},nearbyText:ua($),cssClasses:ca($)};i(U=>[...U,ue])},R))}),()=>{f.forEach(clearTimeout)}},[n,ct,e,t]),(0,S.useEffect)(()=>{let f=()=>{fa(window.scrollY),pa(!0),lr.current&&clearTimeout(lr.current),lr.current=setTimeout(()=>{pa(!1)},150)};return window.addEventListener("scroll",f,{passive:!0}),()=>{window.removeEventListener("scroll",f),lr.current&&clearTimeout(lr.current)}},[]),(0,S.useEffect)(()=>{ct&&l.length>0?U_(xt,l):ct&&l.length===0&&localStorage.removeItem(Dl(xt))},[l,xt,ct]);let Ia=(0,S.useCallback)(()=>{if(et)return;let f=document.createElement("style");f.id="feedback-freeze-styles",f.textContent=`
      *:not([data-feedback-toolbar]):not([data-feedback-toolbar] *):not([data-annotation-popup]):not([data-annotation-popup] *):not([data-annotation-marker]):not([data-annotation-marker] *),
      *:not([data-feedback-toolbar]):not([data-feedback-toolbar] *):not([data-annotation-popup]):not([data-annotation-popup] *):not([data-annotation-marker]):not([data-annotation-marker] *)::before,
      *:not([data-feedback-toolbar]):not([data-feedback-toolbar] *):not([data-annotation-popup]):not([data-annotation-popup] *):not([data-annotation-marker]):not([data-annotation-marker] *)::after {
        animation-play-state: paused !important;
        transition: none !important;
      }
    `,document.head.appendChild(f),document.querySelectorAll("video").forEach(y=>{y.paused||(y.dataset.wasPaused="false",y.pause())}),ma(!0)},[et]),ao=(0,S.useCallback)(()=>{if(!et)return;let f=document.getElementById("feedback-freeze-styles");f&&f.remove(),document.querySelectorAll("video").forEach(y=>{y.dataset.wasPaused==="false"&&(y.play(),delete y.dataset.wasPaused)}),ma(!1)},[et]),Uf=(0,S.useCallback)(()=>{et?ao():Ia()},[et,Ia,ao]);(0,S.useEffect)(()=>{r||(c(null),to(null),C(null),ha(!1),et&&ao())},[r,et,ao]),(0,S.useEffect)(()=>{if(!r)return;let f=document.createElement("style");return f.id="feedback-cursor-styles",f.textContent=`
      body * {
        cursor: crosshair !important;
      }
      body p, body span, body h1, body h2, body h3, body h4, body h5, body h6,
      body li, body td, body th, body label, body blockquote, body figcaption,
      body caption, body legend, body dt, body dd, body pre, body code,
      body em, body strong, body b, body i, body u, body s, body a,
      body time, body address, body cite, body q, body abbr, body dfn,
      body mark, body small, body sub, body sup, body [contenteditable],
      body p *, body span *, body h1 *, body h2 *, body h3 *, body h4 *,
      body h5 *, body h6 *, body li *, body a *, body label *, body pre *,
      body code *, body blockquote *, body [contenteditable] * {
        cursor: text !important;
      }
      [data-feedback-toolbar], [data-feedback-toolbar] * {
        cursor: default !important;
      }
      [data-annotation-marker], [data-annotation-marker] * {
        cursor: pointer !important;
      }
    `,document.head.appendChild(f),()=>{let y=document.getElementById("feedback-cursor-styles");y&&y.remove()}},[r]),(0,S.useEffect)(()=>{if(!r||u)return;let f=y=>{if(y.target.closest("[data-feedback-toolbar]")){C(null);return}let b=document.elementFromPoint(y.clientX,y.clientY);if(!b||b.closest("[data-feedback-toolbar]")){C(null);return}let{name:R,path:$}=qr(b),O=b.getBoundingClientRect();C({element:R,elementPath:$,rect:O}),J({x:y.clientX,y:y.clientY})};return document.addEventListener("mousemove",f),()=>document.removeEventListener("mousemove",f)},[r,u]),(0,S.useEffect)(()=>{if(!r)return;let f=y=>{if(io.current){io.current=!1;return}let b=y.target;if(b.closest("[data-feedback-toolbar]")||b.closest("[data-annotation-popup]")||b.closest("[data-annotation-marker]"))return;let R=b.closest("button, a, input, select, textarea, [role='button'], [onclick]");if(D.blockInteractions&&R&&(y.preventDefault(),y.stopPropagation()),u){if(R&&!D.blockInteractions)return;y.preventDefault(),ba.current?.shake();return}if(W){if(R&&!D.blockInteractions)return;y.preventDefault(),Ma.current?.shake();return}y.preventDefault();let $=document.elementFromPoint(y.clientX,y.clientY);if(!$)return;let{name:O,path:q}=qr($),H=$.getBoundingClientRect(),ue=y.clientX/window.innerWidth*100,U=V_($),F=U?y.clientY:y.clientY+window.scrollY,X=window.getSelection(),Pe;X&&X.toString().trim().length>0&&(Pe=X.toString().trim().slice(0,500));let Z=bf($),ee=Object.entries(Z).map(([wt,ft])=>`${wt}: ${ft}`).join("; ");c({x:ue,y:F,clientY:y.clientY,element:O,elementPath:q,selectedText:Pe,boundingBox:{x:H.left,y:U?H.top:H.top+window.scrollY,width:H.width,height:H.height},nearbyText:ua($),cssClasses:ca($),isFixed:U,fullPath:Tf($),accessibility:Mf($),computedStyles:ee,nearbyElements:Nf($)}),C(null)};return document.addEventListener("click",f,!0),()=>document.removeEventListener("click",f,!0)},[r,u,W,D.blockInteractions]),(0,S.useEffect)(()=>{if(!r||u)return;let f=y=>{let b=y.target;b.closest("[data-feedback-toolbar]")||b.closest("[data-annotation-marker]")||b.closest("[data-annotation-popup]")||new Set(["P","SPAN","H1","H2","H3","H4","H5","H6","LI","TD","TH","LABEL","BLOCKQUOTE","FIGCAPTION","CAPTION","LEGEND","DT","DD","PRE","CODE","EM","STRONG","B","I","U","S","A","TIME","ADDRESS","CITE","Q","ABBR","DFN","MARK","SMALL","SUB","SUP"]).has(b.tagName)||b.isContentEditable||(wn.current={x:y.clientX,y:y.clientY})};return document.addEventListener("mousedown",f),()=>document.removeEventListener("mousedown",f)},[r,u]),(0,S.useEffect)(()=>{if(!r||u)return;let f=y=>{if(!wn.current)return;let b=y.clientX-wn.current.x,R=y.clientY-wn.current.y,$=b*b+R*R,O=Al*Al;if(!kt&&$>=O&&(dt.current=wn.current,Pa(!0)),(kt||$>=O)&&dt.current){if(rr.current){let A=Math.min(dt.current.x,y.clientX),Y=Math.min(dt.current.y,y.clientY),Xe=Math.abs(y.clientX-dt.current.x),_e=Math.abs(y.clientY-dt.current.y);rr.current.style.transform=`translate(${A}px, ${Y}px)`,rr.current.style.width=`${Xe}px`,rr.current.style.height=`${_e}px`}let q=Date.now();if(q-Na.current<Wf)return;Na.current=q;let H=dt.current.x,ue=dt.current.y,U=Math.min(H,y.clientX),F=Math.min(ue,y.clientY),X=Math.max(H,y.clientX),Pe=Math.max(ue,y.clientY),Z=(U+X)/2,ee=(F+Pe)/2,wt=new Set,ft=[[U,F],[X,F],[U,Pe],[X,Pe],[Z,ee],[Z,F],[Z,Pe],[U,ee],[X,ee]];for(let[A,Y]of ft){let Xe=document.elementsFromPoint(A,Y);for(let _e of Xe)_e instanceof HTMLElement&&wt.add(_e)}let Bl=document.querySelectorAll("button, a, input, img, p, h1, h2, h3, h4, h5, h6, li, label, td, th, div, span, section, article, aside, nav");for(let A of Bl)if(A instanceof HTMLElement){let Y=A.getBoundingClientRect(),Xe=Y.left+Y.width/2,_e=Y.top+Y.height/2,Sn=Xe>=U&&Xe<=X&&_e>=F&&_e<=Pe,Ct=Math.min(Y.right,X)-Math.max(Y.left,U),Ra=Math.min(Y.bottom,Pe)-Math.max(Y.top,F),Gf=Ct>0&&Ra>0?Ct*Ra:0,ja=Y.width*Y.height,Jf=ja>0?Gf/ja:0;(Sn||Jf>.5)&&wt.add(A)}let Cn=[],_t=new Set(["BUTTON","A","INPUT","IMG","P","H1","H2","H3","H4","H5","H6","LI","LABEL","TD","TH","SECTION","ARTICLE","ASIDE","NAV"]);for(let A of wt){if(A.closest("[data-feedback-toolbar]")||A.closest("[data-annotation-marker]"))continue;let Y=A.getBoundingClientRect();if(!(Y.width>window.innerWidth*.8&&Y.height>window.innerHeight*.5)&&!(Y.width<10||Y.height<10)&&Y.left<X&&Y.right>U&&Y.top<Pe&&Y.bottom>F){let Xe=A.tagName,_e=_t.has(Xe);if(!_e&&(Xe==="DIV"||Xe==="SPAN")){let Sn=A.textContent&&A.textContent.trim().length>0,Ct=A.onclick!==null||A.getAttribute("role")==="button"||A.getAttribute("role")==="link"||A.classList.contains("clickable")||A.hasAttribute("data-clickable");(Sn||Ct)&&!A.querySelector("p, h1, h2, h3, h4, h5, h6, button, a")&&(_e=!0)}if(_e){let Sn=!1;for(let Ct of Cn)if(Ct.left<=Y.left&&Ct.right>=Y.right&&Ct.top<=Y.top&&Ct.bottom>=Y.bottom){Sn=!0;break}Sn||Cn.push(Y)}}}if(or.current){let A=or.current;for(;A.children.length>Cn.length;)A.removeChild(A.lastChild);Cn.forEach((Y,Xe)=>{let _e=A.children[Xe];_e||(_e=document.createElement("div"),_e.className=p.selectedElementHighlight,A.appendChild(_e)),_e.style.transform=`translate(${Y.left}px, ${Y.top}px)`,_e.style.width=`${Y.width}px`,_e.style.height=`${Y.height}px`})}}};return document.addEventListener("mousemove",f,{passive:!0}),()=>document.removeEventListener("mousemove",f)},[r,u,kt,Al]),(0,S.useEffect)(()=>{if(!r)return;let f=y=>{let b=kt,R=dt.current;if(kt&&R){io.current=!0;let $=Math.min(R.x,y.clientX),O=Math.min(R.y,y.clientY),q=Math.max(R.x,y.clientX),H=Math.max(R.y,y.clientY),ue=[];document.querySelectorAll("button, a, input, img, p, h1, h2, h3, h4, h5, h6, li, label, td, th").forEach(Z=>{if(!(Z instanceof HTMLElement)||Z.closest("[data-feedback-toolbar]")||Z.closest("[data-annotation-marker]"))return;let ee=Z.getBoundingClientRect();ee.width>window.innerWidth*.8&&ee.height>window.innerHeight*.5||ee.width<10||ee.height<10||ee.left<q&&ee.right>$&&ee.top<H&&ee.bottom>O&&ue.push({element:Z,rect:ee})});let F=ue.filter(({element:Z})=>!ue.some(({element:ee})=>ee!==Z&&Z.contains(ee))),X=y.clientX/window.innerWidth*100,Pe=y.clientY+window.scrollY;if(F.length>0){let Z=F.reduce((_t,{rect:A})=>({left:Math.min(_t.left,A.left),top:Math.min(_t.top,A.top),right:Math.max(_t.right,A.right),bottom:Math.max(_t.bottom,A.bottom)}),{left:1/0,top:1/0,right:-1/0,bottom:-1/0}),ee=F.slice(0,5).map(({element:_t})=>qr(_t).name).join(", "),wt=F.length>5?` +${F.length-5} more`:"",ft=F[0].element,Bl=bf(ft),Cn=Object.entries(Bl).map(([_t,A])=>`${_t}: ${A}`).join("; ");c({x:X,y:Pe,clientY:y.clientY,element:`${F.length} elements: ${ee}${wt}`,elementPath:"multi-select",boundingBox:{x:Z.left,y:Z.top+window.scrollY,width:Z.right-Z.left,height:Z.bottom-Z.top},isMultiSelect:!0,fullPath:Tf(ft),accessibility:Mf(ft),computedStyles:Cn,nearbyElements:Nf(ft),cssClasses:ca(ft),nearbyText:ua(ft)})}else{let Z=Math.abs(q-$),ee=Math.abs(H-O);Z>20&&ee>20&&c({x:X,y:Pe,clientY:y.clientY,element:"Area selection",elementPath:`region at (${Math.round($)}, ${Math.round(O)})`,boundingBox:{x:$,y:O+window.scrollY,width:Z,height:ee},isMultiSelect:!0})}C(null)}else b&&(io.current=!0);wn.current=null,dt.current=null,Pa(!1),or.current&&(or.current.innerHTML="")};return document.addEventListener("mouseup",f),()=>document.removeEventListener("mouseup",f)},[r,kt]);let Hf=(0,S.useCallback)(f=>{if(!u)return;let y={id:Date.now().toString(),x:u.x,y:u.y,comment:f,element:u.element,elementPath:u.elementPath,timestamp:Date.now(),selectedText:u.selectedText,boundingBox:u.boundingBox,nearbyText:u.nearbyText,cssClasses:u.cssClasses,isMultiSelect:u.isMultiSelect,isFixed:u.isFixed,fullPath:u.fullPath,accessibility:u.accessibility,computedStyles:u.computedStyles,nearbyElements:u.nearbyElements};i(b=>[...b,y]),so.current=y.id,setTimeout(()=>{so.current=null},300),setTimeout(()=>{ro(b=>new Set(b).add(y.id))},250),oo(!0),setTimeout(()=>{c(null),oo(!1)},150),window.getSelection()?.removeAllRanges()},[u]),Xf=(0,S.useCallback)(()=>{oo(!0),setTimeout(()=>{c(null),oo(!1)},150)},[]),Oa=(0,S.useCallback)(f=>{let y=l.findIndex(b=>b.id===f);vn(f),La(b=>new Set(b).add(f)),setTimeout(()=>{i(b=>b.filter(R=>R.id!==f)),La(b=>{let R=new Set(b);return R.delete(f),R}),vn(null),y<l.length-1&&(eo(y),setTimeout(()=>eo(null),200))},150)},[l]),za=(0,S.useCallback)(f=>{to(f),z(null)},[]),Qf=(0,S.useCallback)(f=>{W&&(i(y=>y.map(b=>b.id===W.id?{...b,comment:f}:b)),lo(!0),setTimeout(()=>{to(null),lo(!1)},150))},[W]),Vf=(0,S.useCallback)(()=>{lo(!0),setTimeout(()=>{to(null),lo(!1)},150)},[]),Yl=(0,S.useCallback)(()=>{let f=l.length;if(f===0)return;I(!0),M(!0);let y=f*30+200;setTimeout(()=>{i([]),ro(new Set),localStorage.removeItem(Dl(xt)),I(!1)},y),setTimeout(()=>M(!1),1500)},[xt,l.length]),Zf=(0,S.useCallback)(async()=>{let f=Z_(l,xt,D.outputDetail);f&&(await navigator.clipboard.writeText(f),k(!0),setTimeout(()=>k(!1),2e3),D.autoClearAfterCopy&&setTimeout(()=>Yl(),500))},[l,xt,D.outputDetail,D.autoClearAfterCopy,Yl]);(0,S.useEffect)(()=>{if(!xn)return;let f=5,y=R=>{let $=R.clientX-xn.x,O=R.clientY-xn.y,q=Math.sqrt($*$+O*O);if(!kn&&q>f&&wa(!0),kn||q>f){let H=xn.toolbarX+$,ue=xn.toolbarY+O,U=20,F=257,X=44,Pe=44;if(r)H=Math.max(U,Math.min(window.innerWidth-F-U,H));else{let Z=F-X,ee=U-Z,wt=window.innerWidth-U-Z-X;H=Math.max(ee,Math.min(wt,H))}ue=Math.max(U,Math.min(window.innerHeight-Pe-U,ue)),xa({x:H,y:ue})}},b=()=>{kn&&(jl.current=!0,setTimeout(()=>{jl.current=!1},50)),wa(!1),Ca(null)};return document.addEventListener("mousemove",y),document.addEventListener("mouseup",b),()=>{document.removeEventListener("mousemove",y),document.removeEventListener("mouseup",b)}},[xn,kn,r]);let Kf=(0,S.useCallback)(f=>{if(f.target.closest("button")||f.target.closest(`.${p.settingsPanel}`))return;let y=f.currentTarget.parentElement;if(!y)return;let b=y.getBoundingClientRect(),R=Ie?.x??b.left,$=Ie?.y??b.top,O=(Math.random()-.5)*10;Yf(O),Ca({x:f.clientX,y:f.clientY,toolbarX:R,toolbarY:$})},[Ie]);if((0,S.useEffect)(()=>{if(!Ie)return;let f=()=>{let O=Ie.x,q=Ie.y;if(r)O=Math.max(20,Math.min(window.innerWidth-257-20,O));else{let U=window.innerWidth-20-213-44;O=Math.max(-193,Math.min(U,O))}q=Math.max(20,Math.min(window.innerHeight-44-20,q)),(O!==Ie.x||q!==Ie.y)&&xa({x:O,y:q})};return f(),window.addEventListener("resize",f),()=>window.removeEventListener("resize",f)},[Ie,r]),(0,S.useEffect)(()=>{let f=y=>{y.key==="Escape"&&(u||r&&o(!1))};return document.addEventListener("keydown",f),()=>document.removeEventListener("keydown",f)},[r,u]),!ct)return null;let uo=l.length>0,co=l.filter(f=>!Ea.has(f.id)),$a=l.filter(f=>Ea.has(f.id)),Da=f=>{let O=f.x/100*window.innerWidth,q=typeof f.y=="string"?parseFloat(f.y):f.y,H={};window.innerHeight-q-22-10<80&&(H.top="auto",H.bottom="calc(100% + 10px)");let U=O-200/2,F=10;if(U<F){let X=F-U;H.left=`calc(50% + ${X}px)`}else if(U+200>window.innerWidth-F){let X=U+200-(window.innerWidth-F);H.left=`calc(50% - ${X}px)`}return H};return(0,zf.createPortal)((0,v.jsxs)(v.Fragment,{children:[(0,v.jsx)("div",{className:p.toolbar,"data-feedback-toolbar":!0,style:Ie?{left:Ie.x,top:Ie.y,right:"auto",bottom:"auto"}:void 0,children:(0,v.jsxs)("div",{className:`${p.toolbarContainer} ${re?"":p.light} ${r?p.expanded:p.collapsed} ${va?p.entrance:""} ${kn?p.dragging:""}`,onClick:r?void 0:f=>{if(jl.current){f.preventDefault();return}o(!0)},onMouseDown:Kf,role:r?void 0:"button",tabIndex:r?-1:0,title:r?void 0:"Start feedback mode",style:kn?{transform:`scale(1.05) rotate(${Af}deg)`,cursor:"grabbing"}:void 0,children:[(0,v.jsxs)("div",{className:`${p.toggleContent} ${r?p.hidden:p.visible}`,children:[(0,v.jsx)(T_,{size:24}),uo&&(0,v.jsx)("span",{className:`${p.badge} ${r?p.fadeOut:""} ${va?p.entrance:""}`,style:{backgroundColor:D.annotationColor},children:l.length})]}),(0,v.jsxs)("div",{className:`${p.controlsContent} ${r?p.visible:p.hidden}`,children:[(0,v.jsx)("button",{className:`${p.controlButton} ${re?"":p.light}`,onClick:f=>{f.stopPropagation(),Uf()},title:et?"Resume animations":"Pause animations","data-active":et,children:(0,v.jsx)(z_,{size:24,isPaused:et})}),(0,v.jsx)("button",{className:`${p.controlButton} ${re?"":p.light}`,onClick:f=>{f.stopPropagation(),a(!s)},disabled:!uo,title:s?"Hide markers":"Show markers",children:(0,v.jsx)(O_,{size:24,isOpen:s})}),(0,v.jsx)("button",{className:`${p.controlButton} ${re?"":p.light}`,onClick:f=>{f.stopPropagation(),Zf()},disabled:!uo,title:"Copy feedback","data-active":_,children:(0,v.jsx)(I_,{size:24,copied:_})}),(0,v.jsx)("button",{className:`${p.controlButton} ${re?"":p.light}`,onClick:f=>{f.stopPropagation(),Yl()},disabled:!uo,title:"Clear all","data-danger":!0,children:(0,v.jsx)(D_,{size:24})}),(0,v.jsx)("button",{className:`${p.controlButton} ${re?"":p.light}`,onClick:f=>{f.stopPropagation(),ha(!Rl)},title:"Settings",children:(0,v.jsx)($_,{size:24})}),(0,v.jsx)("div",{className:`${p.divider} ${re?"":p.light}`}),(0,v.jsx)("button",{className:`${p.controlButton} ${re?"":p.light}`,onClick:f=>{f.stopPropagation(),o(!1)},title:"Exit feedback mode",children:(0,v.jsx)(R_,{size:24})})]}),(0,v.jsxs)("div",{className:`${p.settingsPanel} ${re?p.dark:p.light} ${Ff?p.enter:p.exit}`,onClick:f=>f.stopPropagation(),style:Ie&&Ie.y<230?{bottom:"auto",top:"calc(100% + 0.5rem)"}:void 0,children:[(0,v.jsxs)("div",{className:p.settingsHeader,children:[(0,v.jsxs)("span",{className:p.settingsBrand,children:[(0,v.jsx)("span",{className:p.settingsBrandSlash,style:{color:D.annotationColor,transition:"color 0.2s ease"},children:"/"}),"agentation"]}),(0,v.jsxs)("span",{className:p.settingsVersion,children:["v","1.1.0"]}),(0,v.jsx)("button",{className:p.themeToggle,onClick:()=>ga(!re),title:re?"Switch to light mode":"Switch to dark mode",children:re?(0,v.jsx)(j_,{size:14}):(0,v.jsx)(F_,{size:14})})]}),(0,v.jsx)("div",{className:p.settingsSection,children:(0,v.jsxs)("div",{className:p.settingsRow,children:[(0,v.jsxs)("div",{className:`${p.settingsLabel} ${re?"":p.light}`,children:["Output Detail",(0,v.jsx)("span",{className:p.helpIcon,"data-tooltip":"Controls how much detail is included in the copied output",children:(0,v.jsx)(Ef,{size:20})})]}),(0,v.jsxs)("button",{className:`${p.cycleButton} ${re?"":p.light}`,onClick:()=>{let y=(Jr.findIndex(b=>b.value===D.outputDetail)+1)%Jr.length;nr(b=>({...b,outputDetail:Jr[y].value}))},children:[(0,v.jsx)("span",{className:p.cycleButtonText,children:Jr.find(f=>f.value===D.outputDetail)?.label},D.outputDetail),(0,v.jsx)("span",{className:p.cycleDots,children:Jr.map((f,y)=>(0,v.jsx)("span",{className:`${p.cycleDot} ${re?"":p.light} ${D.outputDetail===f.value?p.active:""}`},f.value))})]})]})}),(0,v.jsxs)("div",{className:p.settingsSection,children:[(0,v.jsx)("div",{className:`${p.settingsLabel} ${p.settingsLabelMarker} ${re?"":p.light}`,children:"Marker Colour"}),(0,v.jsx)("div",{className:p.colorOptions,children:Q_.map(f=>(0,v.jsx)("div",{onClick:()=>nr(y=>({...y,annotationColor:f.value})),style:{borderColor:D.annotationColor===f.value?f.value:"transparent"},className:`${p.colorOptionRing} ${D.annotationColor===f.value?p.selected:""}`,children:(0,v.jsx)("div",{className:`${p.colorOption} ${D.annotationColor===f.value?p.selected:""}`,style:{backgroundColor:f.value},title:f.label},f.value)}))})]}),(0,v.jsxs)("div",{className:p.settingsSection,children:[(0,v.jsxs)("label",{className:p.settingsToggle,children:[(0,v.jsx)("input",{type:"checkbox",id:"autoClearAfterCopy",checked:D.autoClearAfterCopy,onChange:f=>nr(y=>({...y,autoClearAfterCopy:f.target.checked}))}),(0,v.jsx)("label",{className:`${p.customCheckbox} ${D.autoClearAfterCopy?p.checked:""}`,htmlFor:"autoClearAfterCopy",children:D.autoClearAfterCopy&&(0,v.jsx)(Lf,{size:14})}),(0,v.jsxs)("span",{className:`${p.toggleLabel} ${re?"":p.light}`,children:["Clear after output",(0,v.jsx)("span",{className:p.helpIcon,"data-tooltip":"Automatically clear annotations after copying",children:(0,v.jsx)(Ef,{size:20})})]})]}),(0,v.jsxs)("label",{className:p.settingsToggle,children:[(0,v.jsx)("input",{type:"checkbox",id:"blockInteractions",checked:D.blockInteractions,onChange:f=>nr(y=>({...y,blockInteractions:f.target.checked}))}),(0,v.jsx)("label",{className:`${p.customCheckbox} ${D.blockInteractions?p.checked:""}`,htmlFor:"blockInteractions",children:D.blockInteractions&&(0,v.jsx)(Lf,{size:14})}),(0,v.jsx)("span",{className:`${p.toggleLabel} ${re?"":p.light}`,children:"Block page interactions"})]})]})]})]})}),(0,v.jsxs)("div",{className:p.markersLayer,"data-feedback-toolbar":!0,children:[d&&co.filter(f=>!f.isFixed).map((f,y)=>{let b=!m&&V===f.id,R=Fe===f.id,$=b||R,O=f.isMultiSelect,q=O?"#34C759":D.annotationColor,H=l.findIndex(F=>F.id===f.id),ue=!Sa.has(f.id),U=m?p.exit:T?p.clearing:ue?p.enter:"";return(0,v.jsxs)("div",{className:`${p.marker} ${$?p.hovered:""} ${O?p.multiSelect:""} ${U}`,"data-annotation-marker":!0,style:{left:`${f.x}%`,top:f.y,backgroundColor:$?void 0:q,animationDelay:m?`${(co.length-1-y)*20}ms`:`${y*20}ms`},onMouseEnter:()=>!m&&f.id!==so.current&&z(f.id),onMouseLeave:()=>z(null),onClick:F=>{F.stopPropagation(),m||Oa(f.id)},onContextMenu:F=>{F.preventDefault(),F.stopPropagation(),m||za(f)},children:[$?(0,v.jsx)(Pf,{size:O?18:16}):(0,v.jsx)("span",{className:Le!==null&&H>=Le?p.renumber:void 0,children:H+1}),b&&!W&&(0,v.jsxs)("div",{className:`${p.markerTooltip} ${re?"":p.light} ${p.enter}`,style:Da(f),children:[(0,v.jsxs)("span",{className:p.markerQuote,children:[f.element,f.selectedText&&` "${f.selectedText.slice(0,30)}${f.selectedText.length>30?"...":""}"`]}),(0,v.jsx)("span",{className:p.markerNote,children:f.comment})]})]},f.id)}),d&&!m&&$a.filter(f=>!f.isFixed).map(f=>{let y=f.isMultiSelect;return(0,v.jsx)("div",{className:`${p.marker} ${p.hovered} ${y?p.multiSelect:""} ${p.exit}`,"data-annotation-marker":!0,style:{left:`${f.x}%`,top:f.y},children:(0,v.jsx)(Pf,{size:y?12:10})},f.id)})]}),(0,v.jsxs)("div",{className:p.fixedMarkersLayer,"data-feedback-toolbar":!0,children:[d&&co.filter(f=>f.isFixed).map((f,y)=>{let b=co.filter(X=>X.isFixed),R=!m&&V===f.id,$=Fe===f.id,O=R||$,q=f.isMultiSelect,H=q?"#34C759":D.annotationColor,ue=l.findIndex(X=>X.id===f.id),U=!Sa.has(f.id),F=m?p.exit:T?p.clearing:U?p.enter:"";return(0,v.jsxs)("div",{className:`${p.marker} ${p.fixed} ${O?p.hovered:""} ${q?p.multiSelect:""} ${F}`,"data-annotation-marker":!0,style:{left:`${f.x}%`,top:f.y,backgroundColor:O?void 0:H,animationDelay:m?`${(b.length-1-y)*20}ms`:`${y*20}ms`},onMouseEnter:()=>!m&&f.id!==so.current&&z(f.id),onMouseLeave:()=>z(null),onClick:X=>{X.stopPropagation(),m||Oa(f.id)},onContextMenu:X=>{X.preventDefault(),X.stopPropagation(),m||za(f)},children:[O?(0,v.jsx)(Sf,{size:q?12:10}):(0,v.jsx)("span",{className:Le!==null&&ue>=Le?p.renumber:void 0,children:ue+1}),R&&!W&&(0,v.jsxs)("div",{className:`${p.markerTooltip} ${re?"":p.light} ${p.enter}`,style:Da(f),children:[(0,v.jsxs)("span",{className:p.markerQuote,children:[f.element,f.selectedText&&` "${f.selectedText.slice(0,30)}${f.selectedText.length>30?"...":""}"`]}),(0,v.jsx)("span",{className:p.markerNote,children:f.comment})]})]},f.id)}),d&&!m&&$a.filter(f=>f.isFixed).map(f=>{let y=f.isMultiSelect;return(0,v.jsx)("div",{className:`${p.marker} ${p.fixed} ${p.hovered} ${y?p.multiSelect:""} ${p.exit}`,"data-annotation-marker":!0,style:{left:`${f.x}%`,top:f.y},children:(0,v.jsx)(Sf,{size:y?12:10})},f.id)})]}),r&&(0,v.jsxs)("div",{className:p.overlay,"data-feedback-toolbar":!0,style:u||W?{zIndex:99999}:void 0,children:[w?.rect&&!u&&!_a&&!kt&&(0,v.jsx)("div",{className:`${p.hoverHighlight} ${p.enter}`,style:{left:w.rect.left,top:w.rect.top,width:w.rect.width,height:w.rect.height,borderColor:`${D.annotationColor}80`,backgroundColor:`${D.annotationColor}0A`}}),V&&!u&&(()=>{let f=l.find(R=>R.id===V);if(!f?.boundingBox)return null;let y=f.boundingBox,b=f.isMultiSelect;return(0,v.jsx)("div",{className:`${b?p.multiSelectOutline:p.singleSelectOutline} ${p.enter}`,style:{left:y.x,top:y.y-no,width:y.width,height:y.height,...b?{}:{borderColor:`${D.annotationColor}99`,backgroundColor:`${D.annotationColor}0D`}}})})(),w&&!u&&!_a&&!kt&&(0,v.jsx)("div",{className:`${p.hoverTooltip} ${p.enter}`,style:{left:Math.max(8,Math.min(L.x,window.innerWidth-100)),top:Math.max(L.y-32,8)},children:w.element}),u&&(0,v.jsxs)(v.Fragment,{children:[u.boundingBox&&(0,v.jsx)("div",{className:`${u.isMultiSelect?p.multiSelectOutline:p.singleSelectOutline} ${Fl?p.exit:p.enter}`,style:{left:u.boundingBox.x,top:u.boundingBox.y-no,width:u.boundingBox.width,height:u.boundingBox.height,...u.isMultiSelect?{}:{borderColor:`${D.annotationColor}99`,backgroundColor:`${D.annotationColor}0D`}}}),(0,v.jsx)("div",{className:`${p.marker} ${p.pending} ${u.isMultiSelect?p.multiSelect:""} ${Fl?p.exit:p.enter}`,style:{left:`${u.x}%`,top:u.clientY,backgroundColor:u.isMultiSelect?"#34C759":D.annotationColor},children:(0,v.jsx)(M_,{size:12})}),(0,v.jsx)(Cf,{ref:ba,element:u.element,selectedText:u.selectedText,placeholder:u.element==="Area selection"?"What should change in this area?":u.isMultiSelect?"Feedback for this group of elements...":"What should change?",onSubmit:Hf,onCancel:Xf,isExiting:Fl,lightMode:!re,accentColor:u.isMultiSelect?"#34C759":D.annotationColor,style:{left:Math.max(160,Math.min(window.innerWidth-160,u.x/100*window.innerWidth)),top:Math.max(20,Math.min(u.clientY+20,window.innerHeight-180))}})]}),W&&(0,v.jsxs)(v.Fragment,{children:[W.boundingBox&&(0,v.jsx)("div",{className:`${W.isMultiSelect?p.multiSelectOutline:p.singleSelectOutline} ${p.enter}`,style:{left:W.boundingBox.x,top:W.boundingBox.y-no,width:W.boundingBox.width,height:W.boundingBox.height,...W.isMultiSelect?{}:{borderColor:`${D.annotationColor}99`,backgroundColor:`${D.annotationColor}0D`}}}),(0,v.jsx)(Cf,{ref:Ma,element:W.element,selectedText:W.selectedText,placeholder:"Edit your feedback...",initialValue:W.comment,submitLabel:"Save",onSubmit:Qf,onCancel:Vf,isExiting:Bf,lightMode:!re,accentColor:W.isMultiSelect?"#34C759":D.annotationColor,style:{left:Math.max(160,Math.min(window.innerWidth-160,W.x/100*window.innerWidth)),top:Math.max(20,Math.min((W.isFixed?W.y:W.y-no)+20,window.innerHeight-180))}})]}),kt&&(0,v.jsxs)(v.Fragment,{children:[(0,v.jsx)("div",{ref:rr,className:p.dragSelection}),(0,v.jsx)("div",{ref:or,className:p.highlightsContainer})]})]})]}),document.body)}var da=document.createElement("div");da.id="agentation-root";document.body.appendChild(da);(0,Rf.createRoot)(da).render(Df.default.createElement($f));
/*! Bundled license information:

react/cjs/react.production.min.js:
  (**
   * @license React
   * react.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

scheduler/cjs/scheduler.production.min.js:
  (**
   * @license React
   * scheduler.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-dom/cjs/react-dom.production.min.js:
  (**
   * @license React
   * react-dom.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react-jsx-runtime.production.min.js:
  (**
   * @license React
   * react-jsx-runtime.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
