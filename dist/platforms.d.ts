import type { Platform } from "./parser.js";
export interface PlatformProfile {
    displayName: string;
    primaryModel: string;
    contextWindowTokens: number;
    costPerMillion: number;
    subscriptionBased: boolean;
    expectedSections: string[];
    vaguenessSensitivity: number;
}
export declare function getProfile(platform: Platform): PlatformProfile;
//# sourceMappingURL=platforms.d.ts.map