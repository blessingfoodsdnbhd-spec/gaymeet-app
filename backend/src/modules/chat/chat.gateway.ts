import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { UserService } from '../user/user.service';
import { NotificationService } from '../notification/notification.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Map userId → socketId for direct messaging
  private userSockets = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.userId = payload.sub;

      this.userSockets.set(payload.sub, client.id);
      await this.userService.setOnlineStatus(payload.sub, true);

      client.broadcast.emit('user:online', { userId: payload.sub });
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.userSockets.delete(client.userId);
      await this.userService.setOnlineStatus(client.userId, false);
      client.broadcast.emit('user:offline', { userId: client.userId });
    }
  }

  @SubscribeMessage('chat:send')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { matchId: string; content: string },
  ) {
    const { matchId, content } = data;
    const senderId = client.userId!;

    // Validate match access
    const match = await this.chatService.validateMatchAccess(matchId, senderId);

    // Save message
    const message = await this.chatService.saveMessage(
      matchId,
      senderId,
      content,
    );

    // Find recipient
    const recipientId =
      match.user1Id === senderId ? match.user2Id : match.user1Id;
    const recipientSocketId = this.userSockets.get(recipientId);

    // Send to recipient if online via WebSocket
    if (recipientSocketId) {
      this.server.to(recipientSocketId).emit('chat:receive', {
        id: message.id,
        matchId,
        senderId,
        content,
        createdAt: message.createdAt,
      });
    } else {
      // 🔔 Recipient offline → send push notification
      this.notificationService
        .sendMessageNotification(recipientId, senderId, matchId, content)
        .catch(() => {});
    }

    // Confirm to sender
    return {
      id: message.id,
      matchId,
      content,
      createdAt: message.createdAt,
    };
  }

  @SubscribeMessage('chat:read')
  async handleRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { matchId: string },
  ) {
    await this.chatService.markAsRead(data.matchId, client.userId!);

    // Notify sender their messages were read
    const match = await this.chatService.validateMatchAccess(
      data.matchId,
      client.userId!,
    );
    const otherUserId =
      match.user1Id === client.userId ? match.user2Id : match.user1Id;
    const otherSocketId = this.userSockets.get(otherUserId);

    if (otherSocketId) {
      this.server.to(otherSocketId).emit('chat:read', {
        matchId: data.matchId,
        readBy: client.userId,
      });
    }
  }
}
