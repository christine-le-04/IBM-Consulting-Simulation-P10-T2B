package com.ibm.consulting.sim.achievement.application;

/**
 * Who would earn an achievement as currently defined, computed without awarding it.
 *
 * @param qualifyingLearners learners whose existing runs already satisfy the rule
 * @param alreadyEarned      of those, how many already hold it (editing only)
 * @param learnersChecked    learners with at least one completed run in scope
 * @param awardable          false while an Exclusive badge's scenario has no Live revision
 */
public record AchievementPreview(int qualifyingLearners, int alreadyEarned, int learnersChecked, boolean awardable) {
}
