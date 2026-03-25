
import React from 'react';
import { twMerge } from 'tailwind-merge';
import { Icons } from '@/components/common/Icons';

export interface StepIndicatorStep {
  label: string;
  icon?: React.ReactNode;
}

export interface StepIndicatorProps {
  steps: StepIndicatorStep[];
  activeStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

/**
 * StepIndicator — a horizontal wizard step bar with completed / active / upcoming states.
 *
 * Visual states:
 *   Completed  — amber-700 background, white checkmark
 *   Active     — amber-500 ring, amber text
 *   Upcoming   — slate-600 background, slate text
 *
 * Accessibility:
 *   - role="navigation" on the outer nav
 *   - aria-label="Progress steps"
 *   - aria-current="step" on the active step
 *   - sr-only labels for screen readers
 *   - Clickable only on completed steps (or all when onStepClick provided)
 */
export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  activeStep,
  onStepClick,
  className,
}) => {
  return (
    <nav
      role="navigation"
      aria-label="Progress steps"
      className={twMerge('flex items-center w-full', className)}
    >
      {steps.map((step, index) => {
        const isCompleted = index < activeStep;
        const isActive = index === activeStep;
        const isUpcoming = index > activeStep;
        const isClickable = !!onStepClick && (isCompleted || isActive);

        return (
          <React.Fragment key={index}>
            {/* Step bubble + label */}
            <div className="flex flex-col items-center flex-shrink-0">
              <button
                type="button"
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${step.label}${isCompleted ? ' (completed)' : isActive ? ' (current)' : ' (upcoming)'}`}
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(index)}
                className={twMerge(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 focus:outline-none',
                  isCompleted && 'bg-amber-700 text-white',
                  isActive && 'bg-amber-500 text-white ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900',
                  isUpcoming && 'bg-slate-600 text-slate-400',
                  isClickable && 'cursor-pointer hover:brightness-110',
                  !isClickable && 'cursor-default'
                )}
              >
                {isCompleted ? (
                  <>
                    <Icons.Check className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">Completed</span>
                  </>
                ) : step.icon ? (
                  <span aria-hidden="true">{step.icon}</span>
                ) : (
                  <span aria-hidden="true">{index + 1}</span>
                )}
              </button>
              <span
                className={twMerge(
                  'mt-1.5 text-xs font-medium text-center leading-tight max-w-[5rem] whitespace-nowrap overflow-hidden text-ellipsis',
                  isCompleted && 'text-amber-600',
                  isActive && 'text-amber-400',
                  isUpcoming && 'text-slate-500'
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line between steps */}
            {index < steps.length - 1 && (
              <div
                aria-hidden="true"
                className={twMerge(
                  'flex-1 h-0.5 mx-2 mb-5 transition-colors duration-200',
                  index < activeStep ? 'bg-amber-700' : 'bg-slate-600'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
