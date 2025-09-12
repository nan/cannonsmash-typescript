/**
 * @file
 * @brief Implementation of ComPenAttackController class.
 * @author KANNA Yoshihiro
 * @version $Id$
 */

// Copyright (C) 2007  神南 吉宏(Kanna Yoshihiro)
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

#include "ttinc.h"
#include "ComPenAttackController.h"
#include "Ball.h"
#include "Control.h"
#include "PlayGame.h"
#include "RCFile.h"

extern Ball   theBall;
extern RCFile *theRC;

/**
 * Default constructor.
 */
ComPenAttackController::ComPenAttackController() : ComController() {
}

/**
 * Constructor.
 * Set parent.
 *
 * @param side side of the player.
 */
ComPenAttackController::ComPenAttackController( Player *parent ) {
  m_parent = parent;
}

/**
 * Destructor.
 * Do nothing.
 */
ComPenAttackController::~ComPenAttackController() {
}


/**
 * Decide where to move and when to swing.
 *
 * @return returns true if succeeds.
 */
bool
ComPenAttackController::Think() {
  double hitT;	// estimation time until ball reaches _hitX, _hitY
  double mx;

  // If the ball status changes, change _hitX, _hitY
  if ( _prevBallstatus != theBall.GetStatus() && theBall.GetStatus() >= 0 ) {
    Hitarea( _hitX );

    _prevBallstatus = theBall.GetStatus();
  }

  if ( theBall.GetV()[1] != 0.0 )
    hitT = (_hitX[1] - theBall.GetX()[1])/theBall.GetV()[1]-TICK;
  else
    hitT = -1.0;

  if ( theBall.GetStatus() == 8 ||
       fabs(_hitX[0]-(m_parent->GetX()[0]+m_parent->GetSide()*0.3)) < fabs(_hitX[0]-(m_parent->GetX()[0]-m_parent->GetSide()*0.3)))
    mx = m_parent->GetX()[0]+m_parent->GetSide()*0.3;
  else
    mx = m_parent->GetX()[0]-m_parent->GetSide()*0.3;

  vector3d v = m_parent->GetV();

  if ( m_parent->GetSwing() > 10 && m_parent->GetSwing() <= 20 ) {
  } else {
    if ( hitT > 0.0 ) {
      double vx = (_hitX[0]-mx)/hitT;
      if ( vx > v[0]+0.1 )
	v[0] += 0.1;
      else if ( vx < v[0]-0.1 )
	v[0] -= 0.1;
      else
	v[0] = vx;
    } else {
      if ( v[0]*fabs(v[0]*0.1)/2 < _hitX[0] - mx )
	v[0] += 0.1;
      else
	v[0] -= 0.1;
    }
  }

  if ( m_parent->GetSwing() > 10 && m_parent->GetSwing() <= 20 ) {
  } else {
    if ( hitT > 0.0 ) {
      double vy = (_hitX[1]-m_parent->GetX()[1])/hitT;
      if ( vy > v[1]+0.1 )
	v[1] += 0.1;
      else if ( vy < v[1]-0.1 )
	v[1] -= 0.1;
      else
	v[1] = vy;
    } else {
      if ( v[1]*fabs(v[1]*0.1)/2 < _hitX[1] - m_parent->GetX()[1] )
	v[1] += 0.1;
      else
	v[1] -= 0.1;
    }
  }

  if ( m_parent->GetSwing() == 19 ) {
    Player *opponent;
    if ( m_parent->GetSide() == -1 )
      opponent = Control::TheControl()->GetThePlayer();
    else
      opponent = Control::TheControl()->GetComPlayer();

    SetTargetX( opponent );
  }

  if ( (theBall.GetStatus() == 0 && m_parent->GetSide() == -1) ||
       (theBall.GetStatus() == 1 && m_parent->GetSide() == -1) ||
       (theBall.GetStatus() == 2 && m_parent->GetSide() == 1) ||
       (theBall.GetStatus() == 3 && m_parent->GetSide() == 1) ||
       (theBall.GetStatus() == 4 && m_parent->GetSide() == -1) ||
       (theBall.GetStatus() == 5 && m_parent->GetSide() == 1) ) {
    if ( v[0] > 5.0 )
      v[0] = 5.0;
    else if ( v[0] < -5.0 )
      v[0] = -5.0;
    if ( v[1] > 5.0 )
      v[1] = 5.0;
    else if ( v[1] < -5.0 )
      v[1] = -5.0;
  } else {
    if ( v.len() >= 1.0 ) {
      double vlen = v.len();
      v = v/vlen*1.0;
    }
  }

  m_parent->SetV(v);


  // Toss
  if ( theBall.GetStatus() == 8 &&
       ( (Control::TheControl()->IsPlaying() &&
	  ((PlayGame *)Control::TheControl())->GetService() == m_parent->GetSide()) ||
	 (!Control::TheControl()->IsPlaying() && m_parent->GetSide() == 1) ) &&
       fabs(m_parent->GetV()[0]) < 0.2 && fabs(m_parent->GetV()[1]) < 0.2 &&
       fabs(m_parent->GetX()[0]+m_parent->GetSide()*0.3-_hitX[0]) < 0.1 && fabs(m_parent->GetX()[1]-_hitX[1]) < 0.1 &&
       m_parent->GetSwing() == 0 ) {
    theBall.Toss( m_parent, 2 );
    m_parent->StartServe(3);

    vector2d target = m_parent->GetTarget();
    target[1] = TABLELENGTH/6*m_parent->GetSide();
    m_parent->SetTarget(target);

    return true;
  }

  if ( fabs( theBall.GetX()[1]+theBall.GetV()[1]*0.1 - _hitX[1] ) < 0.2 /*&&
       m_parent->GetSwing() == 0*/ ){
    // Calc the ball location of 0.1 second later.
    // This part seems to be the same as Swing(). Consider again.
    Ball *tmpBall;
    vector3d  tmpBallX;
    vector2d tmpX;

    tmpBall = new Ball(&theBall);

    for ( int i = 0 ; i < 9 ; i++ )
      tmpBall->Move();
    tmpX[0] = m_parent->GetX()[0]+m_parent->GetV()[0]*0.08;
    tmpX[1] = m_parent->GetX()[1]+m_parent->GetV()[1]*0.08;

    if ( m_parent->canHitBall(tmpBall) &&
	 (tmpX[1]-tmpBall->GetX()[1])*m_parent->GetSide() < 0.3 &&
	 (tmpX[1]-tmpBall->GetX()[1])*m_parent->GetSide() > -0.6 &&
	 m_parent->GetSwing() <= 10 ) {

      tmpBallX = tmpBall->GetX();

      // If the ball location becomes better at 1/100 second later, wait.
      tmpBall->Move();
      if ( fabs(tmpX[1]+m_parent->GetV()[1]*0.01-tmpBall->GetX()[1]) <
	   fabs(tmpX[1]-tmpBallX[1]) &&
	   fabs(tmpX[1]-tmpBallX[1]) > LEVELMARGIN ) {
	delete tmpBall;
	return true;
      }

      _hitX[0] = tmpBallX[0];
      _hitX[1] = tmpBallX[1];

      vector2d target = m_parent->GetTarget();
      if ( (tmpBallX[2]-TABLEHEIGHT)/fabs(tmpBallX[1]-target[1]) < 0.0 )
	target[1] = TABLELENGTH/4*m_parent->GetSide();
      else if ( (tmpBallX[2]-TABLEHEIGHT)/fabs(tmpBallX[1]-target[1]) < 0.1 )
	target[1] = TABLELENGTH/3*m_parent->GetSide();
      else
	target[1] = TABLELENGTH/16*6*m_parent->GetSide();
      m_parent->SetTarget(target);

      if ( (m_parent->GetX()[0]-tmpBallX[0])*m_parent->GetSide() < 0 )
	m_parent->Swing(3);
      else
	m_parent->Swing(1);
    }
    delete tmpBall;
  }

  return true;
}


/**
 * Decide the x-coordinates of the target.
 *
 * @param opponent Player object of the opponent.
 * @return returns true if succeeds.
 */
bool
ComPenAttackController::SetTargetX( Player *opponent ) {
  double width;

  switch ( theRC->gameLevel ) {
  case LEVEL_EASY:
    width = TABLEWIDTH/4;
    break;
  case LEVEL_NORMAL:
    width = TABLEWIDTH/2;
    break;
  case LEVEL_HARD:
  case LEVEL_TSUBORISH:
    width = TABLEWIDTH;
    break;
  default:
    return false;
  }

  vector2d target = m_parent->GetTarget();
  if ( opponent->GetPlayerType() == PLAYER_PENDRIVE ) {
    switch ( RAND(4) ) {
    case 0:
      target[0] = -width*7/16;
      break;
    case 1:
      target[0] = -width*5/16;
      break;
    case 2:
      target[0] = -width*3/16;
      break;
    case 3:
      target[0] = -width*1/16;
      break;
    }
  } else {
    switch ( RAND(8) ) {
    case 0:
      target[0] = -width*7/16;
      break;
    case 1:
      target[0] = -width*5/16;
      break;
    case 2:
      target[0] = -width*3/16;
      break;
    case 3:
      target[0] = -width*1/16;
      break;
    case 4:
      target[0] = width*1/16;
      break;
    case 5:
      target[0] = width*3/16;
      break;
    case 6:
      target[0] = width*5/16;
      break;
    case 7:
      target[0] = width*7/16;
      break;
    }
  }

  if ( theRC->gameLevel == LEVEL_TSUBORISH ) {
    if ( opponent->GetX()[0]+opponent->GetV()[0]*0.5 < 0.0 ) {
      target[0] = width*7/16;
    } else {
      target[0] = -width*7/16;
    }

    if ( RAND(4) == 0 ) {
      target[0] = -target[0];
    }
  }

  if ( m_parent->GetV()[0] > 1.5 ) {
    target[0] += TABLEWIDTH/2;
  } else if ( m_parent->GetV()[0] > 0.5 ) {
    target[0] += TABLEWIDTH/4;
  } else if ( m_parent->GetV()[0] < -1.5 ) {
    target[0] -= TABLEWIDTH/2;
  } else if ( m_parent->GetV()[0] < -0.5 ) {
    target[0] -= TABLEWIDTH/4;
  }

  if ( target[0] > TABLEWIDTH/2 )
    target[0] = TABLEWIDTH*7/16;
  if ( target[0] < -TABLEWIDTH/2 )
    target[0] = -TABLEWIDTH*7/16;

  m_parent->SetTarget(target);

  return true;
}
