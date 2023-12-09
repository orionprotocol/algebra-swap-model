"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveFee = void 0;
const UINT16_MAX = 2n ** 16n - 1n;
class AdaptiveFee {
    // alpha1 + alpha2 + baseFee must be <= type(uint16).max
    /// @notice Calculates fee based on formula:
    /// baseFee + sigmoidVolume(sigmoid1(volatility, volumePerLiquidity) + sigmoid2(volatility, volumePerLiquidity))
    /// maximum value capped by baseFee + alpha1 + alpha2
    static getFee(volatility, volumePerLiquidity, config) {
        let sumOfSigmoids = AdaptiveFee.sigmoid(volatility, config.gamma1, config.alpha1, config.beta1) +
            AdaptiveFee.sigmoid(volatility, config.gamma2, config.alpha2, config.beta2);
        if (sumOfSigmoids > UINT16_MAX) {
            // should be impossible, just in case
            sumOfSigmoids = UINT16_MAX;
        }
        return config.baseFee + AdaptiveFee.sigmoid(volumePerLiquidity, config.volumeGamma, sumOfSigmoids, config.volumeBeta); // safe since alpha1 + alpha2 + baseFee _must_ be <= type(uint16).max
    }
    /// @notice calculates α / (1 + e^( (β-x) / γ))
    /// that is a sigmoid with a maximum value of α, x-shifted by β, and stretched by γ
    /// @dev returns uint256 for fuzzy testing. Guaranteed that the result is not greater than alpha
    static sigmoid(x, g, alpha, beta) {
        let res;
        if (x > beta) {
            x = x - beta;
            if (x >= 6n * g)
                return alpha; // so x < 19 bits
            const g8 = g ** 8n; // < 128 bits (8*16)
            const ex = AdaptiveFee.exp(x, g, g8); // < 155 bits
            res = (alpha * ex) / (g8 + ex); // in worst case: (16 + 155 bits) / 155 bits
            // so res <= alpha
        }
        else {
            x = beta - x;
            if (x >= 6n * g)
                return 0n; // so x < 19 bits
            const g8 = g ** 8n; // < 128 bits (8*16)
            const ex = g8 + AdaptiveFee.exp(x, g, g8); // < 156 bits
            res = (alpha * g8) / ex; // in worst case: (16 + 128 bits) / 156 bits
            // g8 <= ex, so res <= alpha
        }
        return res;
    }
    /// @notice calculates e^(x/g) * g^8 in a series, since (around zero):
    /// e^x = 1 + x + x^2/2 + ... + x^n/n! + ...
    /// e^(x/g) = 1 + x/g + x^2/(2*g^2) + ... + x^(n)/(g^n * n!) + ...
    static exp(x, g, gHighestDegree) {
        // calculating:
        // g**8 + x * g**7 + (x**2 * g**6) / 2 + (x**3 * g**5) / 6 + (x**4 * g**4) / 24 + (x**5 * g**3) / 120 + (x**6 * g^2) / 720 + x**7 * g / 5040 + x**8 / 40320
        // x**8 < 152 bits (19*8) and g**8 < 128 bits (8*16)
        // so each summand < 152 bits and res < 155 bits
        let xLowestDegree = x;
        let res = gHighestDegree; // g**8
        gHighestDegree /= g; // g**7
        res += xLowestDegree * gHighestDegree;
        gHighestDegree /= g; // g**6
        xLowestDegree *= x; // x**2
        res += (xLowestDegree * gHighestDegree) / 2n;
        gHighestDegree /= g; // g**5
        xLowestDegree *= x; // x**3
        res += (xLowestDegree * gHighestDegree) / 6n;
        gHighestDegree /= g; // g**4
        xLowestDegree *= x; // x**4
        res += (xLowestDegree * gHighestDegree) / 24n;
        gHighestDegree /= g; // g**3
        xLowestDegree *= x; // x**5
        res += (xLowestDegree * gHighestDegree) / 120n;
        gHighestDegree /= g; // g**2
        xLowestDegree *= x; // x**6
        res += (xLowestDegree * gHighestDegree) / 720n;
        xLowestDegree *= x; // x**7
        res += (xLowestDegree * g) / 5040n + (xLowestDegree * x) / (40320n);
        return res;
    }
}
exports.AdaptiveFee = AdaptiveFee;
//# sourceMappingURL=adaptiveFee.js.map