import { describe, expect, it, vi } from "vitest";
import { syncCameraSubscriptions } from "./camera-subscriptions";

function participant(identity: string, hasCamera = true, initiallyDesired = true) {
  const setSubscribed = vi.fn();
  let isDesired = initiallyDesired;
  return {
    participant: {
      identity,
      getTrackPublication: vi.fn(() => hasCamera ? {
        get isDesired() {
          return isDesired;
        },
        setSubscribed(subscribed: boolean) {
          isDesired = subscribed;
          setSubscribed(subscribed);
        },
      } : undefined),
    },
    setSubscribed,
  };
}

describe("camera subscription selection", () => {
  it("subscribes only to the remote tutor and active student", () => {
    const tutor = participant("tutor");
    const activeStudent = participant("student-active", true, false);
    const otherStudent = participant("student-other");

    syncCameraSubscriptions(
      [tutor.participant, activeStudent.participant, otherStudent.participant],
      "tutor",
      "student-active",
    );

    expect(tutor.setSubscribed).not.toHaveBeenCalled();
    expect(activeStudent.setSubscribed).toHaveBeenLastCalledWith(true);
    expect(otherStudent.setSubscribed).toHaveBeenLastCalledWith(false);
  });

  it("unsubscribes the previous speaker when the active student changes", () => {
    const tutor = participant("tutor");
    const previousStudent = participant("student-previous");
    const nextStudent = participant("student-next");
    const participants = [tutor.participant, previousStudent.participant, nextStudent.participant];

    syncCameraSubscriptions(participants, "tutor", "student-previous");
    syncCameraSubscriptions(participants, "tutor", "student-next");

    expect(previousStudent.setSubscribed).toHaveBeenLastCalledWith(false);
    expect(nextStudent.setSubscribed).toHaveBeenLastCalledWith(true);
  });

  it("does not resend subscription updates when selection is unchanged", () => {
    const tutor = participant("tutor");
    const otherStudent = participant("student-other");
    const participants = [tutor.participant, otherStudent.participant];

    syncCameraSubscriptions(participants, "tutor");
    syncCameraSubscriptions(participants, "tutor");

    expect(tutor.setSubscribed).not.toHaveBeenCalled();
    expect(otherStudent.setSubscribed).toHaveBeenCalledTimes(1);
    expect(otherStudent.setSubscribed).toHaveBeenCalledWith(false);
  });

  it("ignores participants without a published camera", () => {
    const audioOnlyStudent = participant("student-audio-only", false);

    expect(() => syncCameraSubscriptions([audioOnlyStudent.participant], "tutor")).not.toThrow();
    expect(audioOnlyStudent.setSubscribed).not.toHaveBeenCalled();
  });
});
