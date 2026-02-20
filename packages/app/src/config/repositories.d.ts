declare const value: {
  repositories: Array<{
    id: string;
    name: string;
    path: string;
    description: string;
    keywords: string[];
    techStack: string[];
    weight: number;
  }>;
  rules: {
    keywordScore: number;
    techStackScore: number;
    primaryThreshold: number;
    secondaryThreshold: number;
  };
};

export default value;
