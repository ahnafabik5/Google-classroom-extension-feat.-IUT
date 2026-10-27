/**
 * Classroom Command Hub - Google Classroom API Client
 */

import { getAuthToken } from "../utils/auth.js";

const BASE_URL = "https://classroom.googleapis.com/v1";

async function classroomFetch(endpoint, token) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    if (response.status === 403) {
      return null;
    }
    const errorBody = await response.text();
    throw new Error(`Classroom API error [${response.status}]: ${errorBody}`);
  }

  return response.json();
}

export async function getActiveCourses() {
  const token = await getAuthToken();
  const data = await classroomFetch("/courses?courseStates=ACTIVE&studentId=me", token);
  return data ? (data.courses || []) : [];
}

export async function getCourseWork(courseId) {
  const token = await getAuthToken();
  const data = await classroomFetch(`/courses/${courseId}/courseWork`, token);
  return data ? (data.courseWork || []) : [];
}

export async function getStudentSubmissions(courseId, courseWorkId) {
  const token = await getAuthToken();
  const data = await classroomFetch(`/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions?userId=me`, token);
  return data ? (data.studentSubmissions || []) : [];
}

export async function getCourseMaterials(courseId) {
  const token = await getAuthToken();
  const data = await classroomFetch(`/courses/${courseId}/courseWorkMaterials`, token);
  return data ? (data.courseWorkMaterial || []) : [];
}

export async function getAnnouncements(courseId) {
  const token = await getAuthToken();
  const data = await classroomFetch(`/courses/${courseId}/announcements`, token);
  return data ? (data.announcements || []) : [];
}