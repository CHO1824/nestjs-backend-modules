/**
 * Type definition for the output of the template engine
 */
export interface RenderedContent {
  title: string;
  message: string;
  sysCode?: string;
  priority?: string | number;
}

export interface NotificationSender {
  readonly channel: string;

  /**
   * Dispatches the notification
   * @param outboxId Outbox ID for tracking
   * @param recipientInfo Recipient info (email, token array, etc.)
   * @param content Rendered content object (NOT a string)
   */
  send(outboxId: string, recipientInfo: string | string[], content: RenderedContent): Promise<void>;
}
