import crypto from 'node:crypto';
import { db } from '../db/database.js';
import { CashuProofService } from './cashuProofService.js';
import { createSignedMintProof } from './cashuMintCrypto.js';

export class AdashiService {
  /**
   * Retrieves all active Adashi circles with member summaries.
   */
  static listCircles(): any[] {
    const circles = db.prepare('SELECT * FROM adashi_circles ORDER BY created_at DESC').all() as any[];
    return circles.map((c) => {
      const members = db
        .prepare('SELECT * FROM adashi_members WHERE circle_id = ? ORDER BY position_order ASC')
        .all(c.id) as any[];
      return {
        ...c,
        membersCount: members.length,
        members,
      };
    });
  }

  /**
   * Retrieves full details for a specific circle.
   */
  static getCircleDetails(circleId: string): any {
    const circle = db.prepare('SELECT * FROM adashi_circles WHERE id = ?').get(circleId) as any;
    if (!circle) {
      throw new Error('Adashi circle not found.');
    }

    const members = db
      .prepare('SELECT * FROM adashi_members WHERE circle_id = ? ORDER BY position_order ASC')
      .all(circleId) as any[];
    const contributions = db
      .prepare('SELECT * FROM adashi_contributions WHERE circle_id = ? ORDER BY created_at DESC')
      .all(circleId) as any[];

    const recipient =
      members.find((m) => m.round_payout_index === circle.current_round) || members[0];

    return {
      circle,
      members,
      contributions,
      currentRecipient: recipient,
      potAccumulatedSats:
        circle.contribution_sats *
        members.filter(
          (m) => m.total_contributed_sats >= circle.current_round * circle.contribution_sats
        ).length,
    };
  }

  /**
   * Creates a new Adashi rotating savings circle in SQLite.
   */
  static createCircle(
    creatorPubkey: string,
    data: {
      id?: string;
      title: string;
      description?: string;
      cycleType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      contributionSats: number;
      contributionNgn: number;
      maxRounds: number;
      creatorAlias?: string;
      members?: Array<{ name: string; turnOrder: number }>;
    }
  ): any {
    const circleId = data.id || 'circle_' + crypto.randomBytes(8).toString('hex');
    const now = Date.now();
    const totalPotSats = data.contributionSats * data.maxRounds;

    db.prepare(`
      INSERT OR REPLACE INTO adashi_circles (id, title, description, creator_pubkey, cycle_type, contribution_sats, contribution_ngn, total_pot_sats, current_round, max_rounds, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'ACTIVE', ?, ?)
    `).run(
      circleId,
      data.title,
      data.description || 'Community Savings Pool',
      creatorPubkey,
      data.cycleType,
      data.contributionSats,
      data.contributionNgn,
      totalPotSats,
      data.maxRounds,
      now,
      now
    );

    const insertMember = db.prepare(`
      INSERT OR IGNORE INTO adashi_members (id, circle_id, user_pubkey, member_alias, position_order, round_payout_index, total_contributed_sats, has_received_payout, status, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'ACTIVE', ?)
    `);

    if (Array.isArray(data.members) && data.members.length > 0) {
      data.members.forEach((m, idx) => {
        const isCreator = idx === 0 || m.name.includes('(You)');
        const pubkey = isCreator
          ? creatorPubkey
          : '02' + crypto.createHash('sha256').update(`${circleId}_${m.name}_${idx}`).digest('hex');
        insertMember.run(
          'm_' + crypto.randomBytes(8).toString('hex'),
          circleId,
          pubkey,
          m.name,
          m.turnOrder || idx + 1,
          m.turnOrder || idx + 1,
          now
        );
      });
    } else {
      insertMember.run(
        'm_' + crypto.randomBytes(8).toString('hex'),
        circleId,
        creatorPubkey,
        data.creatorAlias || 'Alhaji Musa (You)',
        1,
        1,
        now
      );
    }

    return this.getCircleDetails(circleId);
  }

  /**
   * Adds a member to an open circle.
   */
  static joinCircle(circleId: string, userPubkey: string, memberAlias: string): any {
    const circle = db.prepare('SELECT * FROM adashi_circles WHERE id = ?').get(circleId) as any;
    if (!circle) {
      throw new Error('Circle not found.');
    }

    const existing = db
      .prepare('SELECT * FROM adashi_members WHERE circle_id = ? AND user_pubkey = ?')
      .get(circleId, userPubkey);
    if (existing) {
      return this.getCircleDetails(circleId);
    }

    const currentMembers = db
      .prepare('SELECT COUNT(*) as count FROM adashi_members WHERE circle_id = ?')
      .get(circleId) as { count: number };
    const order = currentMembers.count + 1;
    const memberId = 'm_' + crypto.randomBytes(8).toString('hex');
    const now = Date.now();

    db.prepare(`
      INSERT INTO adashi_members (id, circle_id, user_pubkey, member_alias, position_order, round_payout_index, total_contributed_sats, has_received_payout, status, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'ACTIVE', ?)
    `).run(memberId, circleId, userPubkey, memberAlias, order, order, now);

    return this.getCircleDetails(circleId);
  }

  /**
   * Registers a round contribution from a member and burns the Cashu proof secret if supplied.
   */
  static contributeRound(
    circleId: string,
    memberPubkey: string,
    amountSats: number,
    proofSecret?: string
  ): any {
    const circle = db.prepare('SELECT * FROM adashi_circles WHERE id = ?').get(circleId) as any;
    if (!circle) throw new Error('Circle not found.');

    if (amountSats < circle.contribution_sats) {
      throw new Error(`Contribution must be at least ${circle.contribution_sats} satoshis.`);
    }

    // Find member by pubkey, or bind to the "(You)" slot if using a newly derived wallet pubkey
    let member = db
      .prepare('SELECT * FROM adashi_members WHERE circle_id = ? AND user_pubkey = ?')
      .get(circleId, memberPubkey) as any;

    if (!member) {
      member = db
        .prepare("SELECT * FROM adashi_members WHERE circle_id = ? AND member_alias LIKE '%(You)%' LIMIT 1")
        .get(circleId) as any;
      if (member) {
        db.prepare('UPDATE adashi_members SET user_pubkey = ? WHERE id = ?').run(
          memberPubkey,
          member.id
        );
      } else {
        this.joinCircle(circleId, memberPubkey, 'Merchant Member (You)');
        member = db
          .prepare('SELECT * FROM adashi_members WHERE circle_id = ? AND user_pubkey = ?')
          .get(circleId, memberPubkey) as any;
      }
    }

    if (proofSecret) {
      CashuProofService.markSpent([proofSecret]);
    }

    const now = Date.now();
    const contribId = 'cnt_' + crypto.randomBytes(8).toString('hex');

    db.prepare(`
      INSERT INTO adashi_contributions (id, circle_id, member_pubkey, round_number, amount_sats, proof_secret, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'SETTLED', ?)
    `).run(
      contribId,
      circleId,
      memberPubkey,
      circle.current_round,
      amountSats,
      proofSecret || null,
      now
    );

    db.prepare(`
      UPDATE adashi_members 
      SET total_contributed_sats = total_contributed_sats + ?
      WHERE id = ?
    `).run(amountSats, member.id);

    return this.getCircleDetails(circleId);
  }

  /**
   * Releases the round payout to the turn beneficiary, issues real BDHKE-signed Cashu proofs,
   * and increments the circle round in SQLite.
   */
  static disburseRoundPayout(circleId: string, _organizerPubkey?: string): any {
    const circle = db.prepare('SELECT * FROM adashi_circles WHERE id = ?').get(circleId) as any;
    if (!circle) throw new Error('Circle not found.');

    const members = db
      .prepare('SELECT * FROM adashi_members WHERE circle_id = ? ORDER BY position_order ASC')
      .all(circleId) as any[];
    const recipient =
      members.find((m) => m.round_payout_index === circle.current_round) || members[0];

    if (!recipient) throw new Error('No recipient found for current round.');

    const now = Date.now();
    const potSats = circle.total_pot_sats || circle.contribution_sats * members.length;

    // Issue BDHKE-signed Cashu payout proofs for the recipient
    const denominations: number[] = [];
    let rem = potSats;
    let cur = 1;
    while (rem > 0) {
      if (rem & cur) {
        denominations.push(cur);
        rem -= cur;
      }
      cur <<= 1;
    }
    const payoutProofs = denominations.map((amt) => createSignedMintProof(amt));

    db.prepare('UPDATE adashi_members SET has_received_payout = 1 WHERE id = ?').run(recipient.id);

    const nextRound = circle.current_round + 1;
    const isCompleted = nextRound > circle.max_rounds;

    db.prepare(`
      UPDATE adashi_circles
      SET current_round = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      isCompleted ? 1 : nextRound,
      isCompleted ? 'COMPLETED' : 'ACTIVE',
      now,
      circleId
    );

    const txId = 'tx_' + crypto.randomBytes(8).toString('hex');
    const txHash = crypto.randomBytes(32).toString('hex');
    db.prepare(`
      INSERT INTO transactions (id, user_pubkey, tx_hash, direction, type, amount_sats, amount_ngn, status, memo, created_at)
      VALUES (?, ?, ?, 'INCOMING', 'ADASHI_PAYOUT', ?, ?, 'SETTLED', ?, ?)
    `).run(
      txId,
      recipient.user_pubkey,
      txHash,
      potSats,
      Math.round(potSats * 1.585),
      `Adashi Round ${circle.current_round} Payout [${circle.title}]`,
      now
    );

    return {
      payoutDistributed: true,
      roundNumber: circle.current_round,
      recipientPubkey: recipient.user_pubkey,
      recipientAlias: recipient.member_alias,
      potSats,
      payoutProofs,
      nextRound: isCompleted ? 'FINISHED' : nextRound,
    };
  }
}
