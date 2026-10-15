import { SUBJECT2_VEHICLE } from "./subject2-vehicle";

// GA 1029-2022, tables 3 and 9-12.
// Source: https://anche.cn/Uploads/20230814052814_254484.pdf#page=19
export const SUBJECT2_STANDARD = {
  training: {
    noProgressLimitSeconds: 12,
    minimumProgressDelta: .05,
  },
  reverseParking: {
    bayLength: SUBJECT2_VEHICLE.length + .7,
    bayWidth: 2.3,
    laneWidth: 6.7,
    controlDistance: 6.7,
    outerClearanceMin: 1,
  },
  sideParking: {
    bayLength: SUBJECT2_VEHICLE.length * 1.5 + 1,
    bayWidth: 2.5,
    laneWidth: 3.4,
    roadBeforeMin: 4.5,
    roadAfterMin: 1,
  },
  ramp: {
    roadLengthMin: 20,
    roadWidth: 3.2,
    poleLineDistance: .5,
    grade: .1,
    rollbackFailDistance: .3,
    stopSpeedMax: .03,
    holdDurationSeconds: 1,
    // GA 1026-2022 requires the candidate to start within 30 seconds after a
    // successful hill stop. The 1-second hold above is a transparent training
    // evidence window, not a claim that the standard mandates that dwell time.
    // https://std.samr.gov.cn/hb/search/stdHBDetailedCNF?id=E424B54CA6246DD7E05397BE0A0A5C54
    launchTimeLimitSeconds: 30,
    verticalCurveRadiusMin: 20,
  },
  sCurve: { outerRadius: 7.5, roadWidth: 3.5 },
  rightAngle: { roadLengthMin: 6.8, roadWidth: 3.6 },
} as const;
