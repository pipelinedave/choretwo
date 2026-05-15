export const normalizeToLocalDate = (value) => {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const buildBoundaries = (now = new Date()) => {
  const today = normalizeToLocalDate(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  return { today, tomorrow, nextWeek };
};

const isSameDay = (left, right) => left?.getTime() === right?.getTime();

export const bucketChores = (chores, now = new Date()) => {
  const { today, tomorrow, nextWeek } = buildBoundaries(now);

  const buckets = {
    all: [],
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    upcoming: [],
  };

  const counts = {
    all: 0,
    overdue: 0,
    today: 0,
    tomorrow: 0,
    thisWeek: 0,
    upcoming: 0,
  };

  chores.forEach((chore) => {
    if (!chore || chore.archived) return;

    const dueDate = normalizeToLocalDate(chore.dueDate);
    if (!dueDate) return;

    buckets.all.push(chore);
    counts.all += 1;

    if (dueDate < today) {
      buckets.overdue.push(chore);
      counts.overdue += 1;
      return;
    }

    if (isSameDay(dueDate, today)) {
      buckets.today.push(chore);
      counts.today += 1;
      return;
    }

    if (isSameDay(dueDate, tomorrow)) {
      buckets.tomorrow.push(chore);
      counts.tomorrow += 1;
      return;
    }

    if (dueDate > tomorrow && dueDate <= nextWeek) {
      buckets.thisWeek.push(chore);
      counts.thisWeek += 1;
      return;
    }

    if (dueDate > nextWeek) {
      buckets.upcoming.push(chore);
      counts.upcoming += 1;
    }
  });

  return { buckets, counts, boundaries: { today, tomorrow, nextWeek } };
};
