import { useRef } from "react";
import { OneEuroFilter2D, OneEuroFilter1D } from "../cv/oneEuroFilter";
import { BodyMeasurements } from "../cv/types";

export function useCvFilters() {
  const lsFilt = useRef(new OneEuroFilter2D());
  const rsFilt = useRef(new OneEuroFilter2D());
  const widthFilt = useRef(new OneEuroFilter1D());
  const tiltFilt = useRef(new OneEuroFilter1D());
  const angleFilt = useRef(new OneEuroFilter1D());

  const applyFilters = (m: BodyMeasurements, now: number): BodyMeasurements => {
    const mirroredLeft = { x: 160 - m.rightShoulder.x, y: m.rightShoulder.y };
    const mirroredRight = { x: 160 - m.leftShoulder.x, y: m.leftShoulder.y };

    return {
      ...m,
      leftShoulder: lsFilt.current.filter(mirroredLeft, now),
      rightShoulder: rsFilt.current.filter(mirroredRight, now),
      shoulderWidth: widthFilt.current.filter(m.shoulderWidth, now),
      shoulderTilt: tiltFilt.current.filter(-m.shoulderTilt, now),
      torsoAngle: angleFilt.current.filter(-m.torsoAngle, now),
    };
  };

  const resetFilters = () => {
    [lsFilt, rsFilt].forEach((f) => f.current.reset());
    [widthFilt, tiltFilt, angleFilt].forEach((f) => f.current.reset());
  };

  return { applyFilters, resetFilters };
}
