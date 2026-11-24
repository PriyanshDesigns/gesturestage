import { useState } from "react";
import type { HandSide } from "../../isl/pose";
import type { Profile } from "../store";
import { HandIcon } from "../components/HandIcon";

interface Props {
  initial: Profile;
  onDone: (profile: Profile) => void;
}

export function Onboarding({ initial, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [dominant, setDominant] = useState<HandSide>(initial.dominant);

  return (
    <main className="ish-onboard">
      <div className="ish-onboard-card">
        <div className="ish-steps" aria-label={`Step ${step + 1} of 2`}>
          {[0, 1].map((i) => (
            <span key={i} className={i <= step ? "on" : ""} />
          ))}
        </div>

        {step === 0 && (
          <>
            <p className="ish-eyebrow">Indian Sign Language · fingerspelling</p>
            <h1 className="ish-display">Fingerspell your first word in ISL, today.</h1>
            <p className="ish-lead">
              Ishaara watches your hands through the webcam and tells you which finger to fix — like a patient teacher
              sitting across the table. Fingerspelling is how you sign names and words you don't know the sign for yet.
            </p>
            <ul className="ish-promises">
              <li>
                <strong>Learn by doing.</strong> Copy the shape, hold it, and the camera confirms it.
              </li>
              <li>
                <strong>Private.</strong> Video never leaves your device; there's no account.
              </li>
              <li>
                <strong>A first win in minutes.</strong> You'll sign a real word in your first session.
              </li>
            </ul>
            <button className="ish-btn ish-btn-primary" onClick={() => setStep(1)}>
              Let's start
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="ish-title">Which hand do you write with?</h2>
            <p className="ish-lead">
              That hand leads in every letter. Left-handed signers mirror the shapes, and Ishaara mirrors its references
              for you.
            </p>
            <div className="ish-choice">
              {(["Right", "Left"] as HandSide[]).map((side) => (
                <button key={side} className={dominant === side ? "on" : ""} onClick={() => setDominant(side)} aria-pressed={dominant === side}>
                  <HandIcon flip={side === "Left"} />
                  {side} hand
                </button>
              ))}
            </div>
            <p className="ish-small ish-dim">
              Next, your browser will ask for the camera. Sit an arm's length away, with light in front of you.
            </p>
            <div className="ish-row">
              <button className="ish-btn" onClick={() => setStep(0)}>
                Back
              </button>
              <button className="ish-btn ish-btn-primary" onClick={() => onDone({ name: "", dominant, onboarded: true })}>
                Start learning
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
