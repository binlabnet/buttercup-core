const PRIMATIVES = ["string", "number", "boolean", "undefined"];

/**
 * Calculate the common command indexes between 2 histories.
 * The common index is where a padding ID matches that of the other history,
 * at some point. If we assume one history may have been flattened, we cannot
 * assume that the entire past history will be the same, but
 * we can assume that at that point, the histories produce the same structure.
 * Because the histories may be different in the future, we use the newest
 * matching pad ID to create a common link between the 2 histories.
 * @param {String[]} historyA The original history
 * @param {String[]} historyB The secondary history
 * @returns {null|{ a: Number, b: Number }} Returns
 *        null if no common point, or an object with the common information. `a` and `b`
 *        are the indexes where the common padding occurs.
 */
function calculateCommonRecentCommand(historyA, historyB) {
    const getCommandType = fullCommand => (fullCommand && fullCommand.length >= 3 ? fullCommand.substr(0, 3) : "");
    const getPaddingID = command => command.split(" ")[1];
    for (let a = historyA.length - 1; a >= 9; a -= 1) {
        if (getCommandType(historyA[a]) === "pad") {
            const paddingA = getPaddingID(historyA[a]);
            for (let b = historyB.length - 1; b >= 0; b -= 1) {
                if (getCommandType(historyB[b]) === "pad" && getPaddingID(historyB[b]) === paddingA) {
                    return { a, b };
                }
            }
        }
    }
    return null;
}

/**
 * Calculate the differences, in commands, between two histories
 * @returns {{ original:String[], secondary:String[] }|Boolean} Returns false if no common base
 *        is found, or the command differences as two arrays
 */
function calculateHistoryDifferences(historyA, historyB) {
    const commonIndexes = calculateCommonRecentCommand(historyA, historyB);
    if (commonIndexes === null) {
        return null;
    }
    return {
        original: historyA.splice(commonIndexes.a + 1, historyA.length),
        secondary: historyB.splice(commonIndexes.b + 1, historyB.length),
        common: historyA
    };
}

/**
 * De-dupe an array
 * @param {Array} arr The array
 * @returns {Array} The de-duped array
 */
function dedupe(arr) {
    return arr.filter(function(item, pos) {
        return arr.indexOf(item) === pos;
    });
}

/**
 * Naïve difference calculator for objects and variables
 * Does not care about array order or instance pointers - only checks for
 * deep *equality*.
 * @param {*} object1 The first item
 * @param {*} object2 The second item
 * @returns {Boolean} True if different, false if equal
 * @private
 */
function different(object1, object2) {
    if (Array.isArray(object1) && Array.isArray(object2)) {
        let differs = object1.some(function(item1) {
            return !object2.some(function(item2) {
                return different(item1, item2) === false;
            });
        });
        if (!differs) {
            return object2.some(function(item1) {
                return !object1.some(function(item2) {
                    return different(item1, item2) === false;
                });
            });
        }
    } else if (typeof object1 === "object" && typeof object2 === "object") {
        if (object1 === null && object2 === null) {
            return false;
        }
        let allKeys = dedupe(Object.keys(object1).concat(Object.keys(object2))),
            isMissingAKey = allKeys.some(function(key) {
                return !(object1.hasOwnProperty(key) && object2.hasOwnProperty(key));
            });
        if (!isMissingAKey) {
            return allKeys.some(function(key) {
                return different(object1[key], object2[key]);
            });
        }
    } else if (PRIMATIVES.indexOf(typeof object1) === PRIMATIVES.indexOf(typeof object2)) {
        return object1 !== object2;
    }
    return true;
}

module.exports = {
    calculateHistoryDifferences,
    /**
     * Check if the objects differ
     * @param {*} o1 The first item
     * @param {*} o2 The second item
     * @returns {Boolean} True if different, false if equal
     * @see different
     */
    objectsDiffer: function(o1, o2) {
        return different(o1, o2);
    }
};
