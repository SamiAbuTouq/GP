"use client";

import { cn } from "@/lib/utils";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

export interface WhatIfLottieIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface WhatIfLottieIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const animationData = {"nm":"Main Scene","ddd":0,"h":500,"w":500,"meta":{"g":"@lottiefiles/creator 1.86.1"},"layers":[{"ty":4,"nm":"Shape Layer 4","sr":1,"st":0,"op":117,"ip":83,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[105,-144,0],"ix":1},"s":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[41,41,100],"t":98},{"s":[62,62,100],"t":114}],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.167,"y":0.167},"i":{"x":0.833,"y":0.833},"s":[200.5,299.75],"t":0},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[200.5,299.75,0],"t":98,"ti":[0,6.667,0],"to":[0,-6.667,0]},{"s":[200.5,259.75,0],"t":114}],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[100],"t":111},{"s":[0],"t":114}],"ix":11}},"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Ellipse 1","ix":1,"cix":2,"np":3,"it":[{"ty":"el","bm":0,"hd":false,"mn":"ADBE Vector Shape - Ellipse","nm":"Ellipse Path 1","d":1,"p":{"a":0,"k":[0,0],"ix":3},"s":{"a":0,"k":[20,20],"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fill 1","c":{"a":0,"k":[0,0,0],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[105,-144],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":1},{"ty":4,"nm":"Shape Layer 3","sr":1,"st":0,"op":117,"ip":83,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[105,-144,0],"ix":1},"s":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[41,41,100],"t":92},{"s":[62,62,100],"t":108}],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.167,"y":0.167},"i":{"x":0.833,"y":0.833},"s":[250.5,299.75],"t":0},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[250.5,299.75,0],"t":92,"ti":[0,6.667,0],"to":[0,-6.667,0]},{"s":[250.5,259.75,0],"t":108}],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[100],"t":105},{"s":[0],"t":108}],"ix":11}},"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Ellipse 1","ix":1,"cix":2,"np":3,"it":[{"ty":"el","bm":0,"hd":false,"mn":"ADBE Vector Shape - Ellipse","nm":"Ellipse Path 1","d":1,"p":{"a":0,"k":[0,0],"ix":3},"s":{"a":0,"k":[20,20],"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fill 1","c":{"a":0,"k":[0.0039,0.0039,0.0039],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[105,-144],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":2},{"ty":4,"nm":"Shape Layer 2","sr":1,"st":0,"op":117,"ip":83,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[105,-144,0],"ix":1},"s":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[41,41,100],"t":88},{"s":[94,94,100],"t":104}],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.167,"y":0.167},"i":{"x":0.833,"y":0.833},"s":[270.5,299.75],"t":0},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[270.5,299.75,0],"t":88,"ti":[0,6.667,0],"to":[0,-6.667,0]},{"s":[270.5,259.75,0],"t":104}],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[100],"t":101},{"s":[0],"t":104}],"ix":11}},"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Ellipse 1","ix":1,"cix":2,"np":3,"it":[{"ty":"el","bm":0,"hd":false,"mn":"ADBE Vector Shape - Ellipse","nm":"Ellipse Path 1","d":1,"p":{"a":0,"k":[0,0],"ix":3},"s":{"a":0,"k":[20,20],"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fill 1","c":{"a":0,"k":[0,0,0],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[105,-144],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":3},{"ty":4,"nm":"Shape Layer 1","sr":1,"st":0,"op":117,"ip":83,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[105,-144,0],"ix":1},"s":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[41,41,100],"t":83},{"s":[62,62,100],"t":99}],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.167,"y":0.167},"i":{"x":0.833,"y":0.833},"s":[230.5,299.75],"t":0},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[230.5,299.75,0],"t":83,"ti":[0,6.667,0],"to":[0,-6.667,0]},{"s":[230.5,259.75,0],"t":99}],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[100],"t":96},{"s":[0],"t":99}],"ix":11}},"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Ellipse 1","ix":1,"cix":2,"np":3,"it":[{"ty":"el","bm":0,"hd":false,"mn":"ADBE Vector Shape - Ellipse","nm":"Ellipse Path 1","d":1,"p":{"a":0,"k":[0,0],"ix":3},"s":{"a":0,"k":[20,20],"ix":2}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fill 1","c":{"a":0,"k":[0,0,0],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[105,-144],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":4},{"ty":4,"nm":"roundFlask Outlines - Group 1","sr":1,"st":0,"op":117,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[25.424,12.07,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":0,"k":[25.424,12.071,0],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Group 1","ix":1,"cix":2,"np":2,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Path 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":false,"i":[[0,0],[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0],[0,0]],"v":[[-1.266,1.348],[-1.266,-1.348],[1.266,-1.348],[1.266,1.348]]},"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":10,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":1,"ix":5},"c":{"a":0,"k":[0,0,0],"ix":3}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[25.424,12.07],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":5,"parent":7},{"ty":4,"nm":"roundFlask Outlines - Group 2","sr":1,"st":0,"op":117,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[25.424,31,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":0,"k":[25.424,31,0],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Group 2","ix":1,"cix":2,"np":2,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Path 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":false,"i":[[0,0],[-2.739,0],[0,0]],"o":[[0,0],[3.457,0],[0,0]],"v":[[16.13,31],[24.347,31],[34.717,31]]},"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":10,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":1,"ix":5},"c":{"a":0,"k":[0.0039,0.0039,0.0039],"ix":3}},{"ty":"tr","a":{"a":0,"k":[26,31.111],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[26,31.111],"ix":2},"r":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[0],"t":15},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[-28],"t":27},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[-28],"t":41},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[11],"t":63},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[-9],"t":74},{"s":[0],"t":86}],"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":6,"parent":7},{"ty":4,"nm":"roundFlask Outlines - Group 3","sr":1,"st":0,"op":117,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[25.424,13.419,0],"ix":1},"s":{"a":0,"k":[900,900,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":0,"k":[249.577,141.561],"ix":2},"r":{"a":1,"k":[{"o":{"x":0.776,"y":0},"i":{"x":0.435,"y":1},"s":[0],"t":0},{"o":{"x":0.631,"y":0},"i":{"x":0.353,"y":1},"s":[-24],"t":23},{"o":{"x":0.275,"y":0},"i":{"x":0.359,"y":1},"s":[24],"t":50},{"s":[0],"t":75}],"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Group 3","ix":1,"cix":2,"np":2,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Path 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[3.944,1.075],[0,0],[0,0],[0,0],[0,-4.286],[-5.133,0],[0,5.132]],"o":[[0,0],[0,0],[0,0],[-3.944,1.075],[0,5.132],[5.133,0],[0,-4.286]],"v":[[2.445,-4.995],[2.445,-13.255],[-2.446,-13.255],[-2.446,-4.995],[-9.294,3.963],[0,13.255],[9.294,3.963]]},"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":10,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":1,"ix":5},"c":{"a":0,"k":[0,0,0],"ix":3}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[25.424,26.864],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":7}],"v":"5.7.0","fr":50,"op":117,"ip":0,"assets":[]};

const WhatIfLottieIcon = forwardRef<WhatIfLottieIconHandle, WhatIfLottieIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 20, ...props }, ref) => {
    const lottieRef = useRef<LottieRefCurrentProps>(null);
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => {
          lottieRef.current?.goToAndStop(0, true);
          lottieRef.current?.play();
        },
        stopAnimation: () => {
          lottieRef.current?.stop();
          lottieRef.current?.goToAndStop(0, true);
        },
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          lottieRef.current?.goToAndStop(0, true);
          lottieRef.current?.play();
        }
      },
      [onMouseEnter],
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          lottieRef.current?.stop();
          lottieRef.current?.goToAndStop(0, true);
        }
      },
      [onMouseLeave],
    );

    return (
      <div
        className={cn("inline-flex items-center justify-center", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          autoplay={false}
          loop={false}
          style={{ width: size, height: size }}
        />
      </div>
    );
  },
);

WhatIfLottieIcon.displayName = "WhatIfLottieIcon";

export { WhatIfLottieIcon };

