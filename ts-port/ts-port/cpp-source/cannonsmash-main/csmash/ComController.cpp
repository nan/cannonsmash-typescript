/**
 * @file
 * @brief Implementation of ComController class.
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
#include "ComController.h"
#include "Ball.h"
#include "PlayGame.h"
#include "RCFile.h"

extern RCFile *theRC;

extern Ball theBall;

/**
 * Default constructor.
 */
ComController::ComController() {
  _prevBallstatus = 0;
  _hitX[0] = 0;
  _hitX[1] = -TABLELENGTH/3;

  SERVEPOSITIONX = 0.0;
  SERVEPOSITIONY = -(TABLELENGTH/2+0.2);

  HOMEPOSITIONX = 0.0;
  HOMEPOSITIONY = -(TABLELENGTH/2+0.5);
}

/**
 * Constructor.
 * Set parent.
 *
 * @param side side of the player.
 */
ComController::ComController( Player *parent ) {
  _prevBallstatus = 0;
  _hitX[0] = 0;
  _hitX[1] = -TABLELENGTH/3;

  m_parent = parent;

  SERVEPOSITIONX = 0.0;
  SERVEPOSITIONY = -(TABLELENGTH/2+0.2);

  HOMEPOSITIONX = 0.0;
  HOMEPOSITIONY = -(TABLELENGTH/2+0.5);
}

/**
 * Destructor.
 * Detach view class.
 */
ComController::~ComController() {
}

/**
 * Move this player object.
 * Move this player and change m_status. Then, call Think() to decide
 * where to move and whether to swing or not.
 *
 * @param KeyHistory history of keyboard input
 * @param MouseXHistory history of mouse cursor move
 * @param MouseYHistory history of mouse cursor move
 * @param MouseBHistory history of mouse button push/release
 * @param Histptr current position of histories described above.
 * @return returns true if it is neccesary to redraw.
 */
bool
ComController::Move( SDL_keysym *KeyHistory, long *MouseXHistory,
		     long *MouseYHistory, unsigned long *MouseBHistory,
		     int Histptr ) {
  vector3d prevV = m_parent->GetV();

  Think();

  // Handicap
  if ( (m_parent->GetV()-prevV).len() > 0.8-theRC->gameLevel*0.1 ) {
    m_parent->AddStatus(-1);
  }

  return true;
}

/**
 * Calculate peak of the ball.
 *
 * @param maxX peak point [out]
 * @param p Player object who want to hit the ball at peak point.
 * @return returns the height of the peak.
 */
double
ComController::GetBallTop( vector2d &maxX, Player *p ) {
  Ball *tmpBall;
  double max = -1.0;             /* highest point of the ball */

  tmpBall = new Ball(&theBall);

  while ( tmpBall->GetStatus() != -1 ) {
    if ( (tmpBall->GetStatus() == 3 && p->GetSide() == 1) ||
	 (tmpBall->GetStatus() == 1 && p->GetSide() == -1) ) {
      if ( tmpBall->GetX()[2] > max &&
	   fabs(tmpBall->GetX()[1]) < TABLELENGTH/2+1.0 &&
	   fabs(tmpBall->GetX()[1]) > TABLELENGTH/2-0.5 ) {
	maxX[0] = tmpBall->GetX()[0];
	maxX[1] = tmpBall->GetX()[1];
	max = tmpBall->GetX()[2];
      }
    }
    tmpBall->Move();
  }

  delete tmpBall;
  return max;
}

/**
 * Returns true if the opponent has hit the ball.
 *
 * @return returns true if the opponent has hit the ball.
 */
bool
ComController::isOpponentHit(Ball *ball) {
  if ( (ball->GetStatus() == 3 && m_parent->GetSide() == 1) ||
       (ball->GetStatus() == 2 && m_parent->GetSide() == 1) ||
       (ball->GetStatus() == 0 && m_parent->GetSide() == -1) ||
       (ball->GetStatus() == 1 && m_parent->GetSide() == -1) ||
       (ball->GetStatus() == 4 && m_parent->GetSide() == -1) ||
       (ball->GetStatus() == 5 && m_parent->GetSide() == 1) )
    return true;
  else
    return false;
}

/**
 * Calc the point of hitting ball.
 * If the ball haven't bound, calc bound point.
 * Then, calc hit point from current ball location or bound location.
 *
 * @param hitX point of hitting [out].
 * @return returns true if succeeds.
 */
bool
ComController::Hitarea( vector2d &hitX ) {
  double max = -1.0;             /* highest point of the ball */
  vector2d maxX = vector2d(0.0);

  if (isOpponentHit(&theBall)) {
    max = GetBallTop( maxX, m_parent );

    if ( max > 0 ) {
      hitX = maxX;
    }
  } else if ( theBall.GetStatus() == 8 ) {
    if ( (Control::TheControl()->IsPlaying() &&
	  ((PlayGame *)Control::TheControl())->GetService() == m_parent->GetSide()) ||
	 m_parent->GetSide() == 1 ) {
      if ( RAND(2) )
	hitX[0] = m_parent->GetTarget()[0];
      else
	hitX[0] = -m_parent->GetTarget()[0];
    } else
      hitX[0] = SERVEPOSITIONX;
    hitX[1] = SERVEPOSITIONY*m_parent->GetSide();
  } else if ( theBall.GetStatus() < 6 ) {
    hitX[0] = HOMEPOSITIONX;
    hitX[1] = HOMEPOSITIONY*m_parent->GetSide();
  }

  return true;
}
