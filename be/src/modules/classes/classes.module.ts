import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module.js';
import { ClassesController } from './classes.controller.js';
import {
  CreateClassHandler,
  RegenerateClassCodeHandler,
  UpdateClassHandler,
} from './commands/handlers/class-crud.handlers.js';
import {
  DeleteGroupHandler,
  SaveGroupHandler,
} from './commands/handlers/class-groups.handlers.js';
import {
  BulkCreateStudentsHandler,
  JoinClassHandler,
  RemoveStudentHandler,
} from './commands/handlers/class-roster.handlers.js';
import {
  ClassAccessHandler,
  StudentClassIdsHandler,
  TeachesStudentHandler,
} from './queries/handlers/class-membership.handlers.js';
import {
  GetClassDetailHandler,
  ListMyClassesHandler,
} from './queries/handlers/class-views.handlers.js';
import { ClassRoom, ClassRoomSchema } from './schemas/class-room.schema.js';

@Module({
  imports: [
    CqrsModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: ClassRoom.name, schema: ClassRoomSchema },
    ]),
  ],
  controllers: [ClassesController],
  providers: [
    // Commands
    CreateClassHandler,
    UpdateClassHandler,
    RegenerateClassCodeHandler,
    JoinClassHandler,
    BulkCreateStudentsHandler,
    RemoveStudentHandler,
    SaveGroupHandler,
    DeleteGroupHandler,
    // Queries (the membership ones are used by other modules via QueryBus)
    ListMyClassesHandler,
    GetClassDetailHandler,
    TeachesStudentHandler,
    ClassAccessHandler,
    StudentClassIdsHandler,
  ],
  exports: [MongooseModule],
})
export class ClassesModule {}
