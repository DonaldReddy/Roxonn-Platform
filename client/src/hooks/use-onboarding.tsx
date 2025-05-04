import { useState, useEffect } from 'react';

type OnboardingKey = 
  | 'hasSeenWelcome' 
  | 'hasSeenRewardsGuide' 
  | 'hasSeenSignInHighlight' 
  | 'hasSeenContributionDemo'
  | 'hasSeenPoolManagerGuide'
  | 'hasSeenFundingGuide';

export function useOnboarding(key: OnboardingKey, initialValue: boolean = false) {
  const [hasSeenGuide, setHasSeenGuide] = useState<boolean>(initialValue);

  useEffect(() => {
    // Check localStorage on component mount
    const storedValue = localStorage.getItem(`roxonn-onboarding-${key}`);
    if (storedValue !== null) {
      setHasSeenGuide(JSON.parse(storedValue));
    }
  }, [key]);

  // Update state and localStorage when value changes
  const setHasSeen = (value: boolean) => {
    setHasSeenGuide(value);
    localStorage.setItem(`roxonn-onboarding-${key}`, JSON.stringify(value));
  };

  return { hasSeenGuide, setHasSeen };
} 