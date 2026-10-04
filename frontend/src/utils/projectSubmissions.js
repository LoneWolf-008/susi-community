const STORAGE_KEY = 'susi_project_submissions';

export function loadProjectSubmissions() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  const submissions = JSON.parse(stored);
  if (!Array.isArray(submissions)) {
    throw new Error('Data pengiriman proyek tidak valid.');
  }
  return submissions;
}

export function saveProjectSubmissions(submissions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
}
