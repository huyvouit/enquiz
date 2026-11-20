/** Students were added to a class (joined with the code or created in bulk). */
export class StudentsJoinedClassEvent {
  constructor(
    public readonly classId: string,
    public readonly studentIds: string[],
  ) {}
}

/** The teacher removed a student from the class. */
export class StudentLeftClassEvent {
  constructor(
    public readonly classId: string,
    public readonly studentId: string,
  ) {}
}
