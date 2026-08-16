import { Track } from "livekit-client";

interface CameraPublication {
  readonly isDesired: boolean;
  setSubscribed(subscribed: boolean): void;
}

interface CameraParticipant {
  identity: string;
  getTrackPublication(source: Track.Source): CameraPublication | undefined;
}

/**
 * Keep remote video limited to the two participants the UI can display.
 * Audio subscriptions are intentionally untouched.
 */
export function syncCameraSubscriptions(
  remoteParticipants: Iterable<CameraParticipant>,
  tutorIdentity?: string,
  activeStudentIdentity?: string,
) {
  const selectedIdentities = new Set(
    [tutorIdentity, activeStudentIdentity].filter((identity): identity is string => Boolean(identity)),
  );

  for (const participant of remoteParticipants) {
    const publication = participant.getTrackPublication(Track.Source.Camera);
    const shouldSubscribe = selectedIdentities.has(participant.identity);
    if (publication && publication.isDesired !== shouldSubscribe) {
      publication.setSubscribed(shouldSubscribe);
    }
  }
}
