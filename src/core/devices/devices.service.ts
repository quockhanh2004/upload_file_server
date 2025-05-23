import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AddDeviceParam,
  ReturnClientParam,
  SendCommandParam,
  UpdateDeviceParam,
} from './device.dto';
import { PrismaErrorCode } from 'src/prisma/prisma.util';
import { firebaseAdmin } from '../../utils/firebase-admin.config';

@Injectable()
export class DevicesService {
  constructor(private readonly prismaService: PrismaService) {}

  public async addDevice(addDevice: AddDeviceParam, userId: string) {
    return await this.prismaService.device
      .create({
        data: { ...addDevice, userId: userId },
      })
      .catch((err) => {
        if (err.code === PrismaErrorCode.UniqueConstraintFailed) {
          throw new ConflictException('Device name already exists');
        }
        throw err;
      });
  }

  public async deleteDevice(deviceId: string, userId: string) {
    return await this.prismaService.device
      .delete({
        where: { id: deviceId, userId },
      })
      .catch((err) => {
        if (err.code === PrismaErrorCode.RecordDoesNotExist) {
          throw new NotFoundException('Device not found');
        }
        throw err;
      });
  }

  public async updateDevice(
    deviceId: string,
    updateDevice: UpdateDeviceParam,
    userId: string,
  ) {
    if (!updateDevice.deviceName && !updateDevice.fcmTokenDevice) {
      throw new Error('At least one field should be provided');
    }

    return await this.prismaService.device
      .update({
        where: { id: deviceId, userId },
        data: { ...updateDevice },
      })
      .catch((err) => {
        if (err.code === PrismaErrorCode.RecordDoesNotExist) {
          throw new NotFoundException('Device not found');
        }
        throw err;
      });
  }

  public async sendCommandToDevice(SendCommandParam: SendCommandParam) {
    Logger.log(SendCommandParam.command);

    const device = await this.prismaService.device.findUnique({
      where: { id: SendCommandParam.deviceId },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (!device.fcmTokenDevice) {
      throw new Error('Device FCM token not found');
    }

    try {
      const response = await firebaseAdmin.messaging().send({
        token: device.fcmTokenDevice,
        android: {
          priority: 'high',
        },
        data: {
          command: SendCommandParam.command,
        },
      });
      return response;
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  public async getDevicesByUserId(userId: string) {
    return await this.prismaService.device.findMany({ where: { userId } });
  }

  public async addMyToken(myToken: string, userId: string) {
    const addToken = await this.prismaService.user
      .update({
        where: { id: userId },
        data: { fcmToken: myToken },
      })
      .catch((error) => {
        if (error.code === PrismaErrorCode.RecordDoesNotExist) {
          throw new NotFoundException('User not found');
        }
        throw error;
      });

    delete addToken.password;
    return addToken;
  }

  public async returnClient(returnClientParam: ReturnClientParam) {
    const device = await this.prismaService.device.findUnique({
      where: { fcmTokenDevice: returnClientParam.fcmTokenDevice },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: device.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    delete user.password;
    try {
      const response = await firebaseAdmin.messaging().send({
        token: user.fcmToken,
        android: {
          priority: 'high',
        },
        data: {
          response: returnClientParam.message,
          deviceName: device.deviceName,
          deviceId: device.id,
        },
      });
      return response;
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
