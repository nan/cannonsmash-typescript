/**
 * @file
 * @brief Implementation of SoloPlay class.
 * @author KANNA Yoshihiro
 * @version $Id$
 */

// Copyright (C) 2000-2004, 2007  (Kanna Yoshihiro)
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
#include "SoloPlay.h"
#include "Player.h"
#include "Ball.h"
#include "Event.h"
#include "BaseView.h"
#include "RCFile.h"

extern RCFile *theRC;

extern Ball theBall;
extern long mode;
extern long wins;

//extern void CopyPlayerData( struct PlayerData& dest, Player* src );
extern void CopyPlayerData( Player& dest, Player* src );

/**
 * Default constructor.
 */
SoloPlay::SoloPlay() {
  m_smash = false;
  m_smashCount = 0;
  m_replayPtr = -1;
}

/**
 * Destructor. Do nothing.
 */
SoloPlay::~SoloPlay() {
}

/**
 * Initializer method.
 * Create PlayGameView and attach it to this object.
 *
 * @return returns true if succeeds.
 */
bool
SoloPlay::Init() {
  m_View = (PlayGameView *)View::CreateView( VIEW_PLAYGAME );

  m_View->Init( this );

  BaseView::TheView()->AddView( m_View );

  return true;
}

/**
 * SoloPlay object creater.
 * This method creates singleton SoloPlay object, and two players.
 *
 * @param player type of the player controlled by this game player.
 * @param com type of the player controlled by the opponent game player.
 */
void
SoloPlay::Create( long player, long com ) {
  Control::ClearControl();

  m_theControl = new SoloPlay();
  m_theControl->Init();

  m_thePlayer = Player::Create( player, 1, 0 );
  m_comPlayer = Player::Create( com, -1, 1 );

  m_thePlayer->Init();
  m_comPlayer->Init();
}

/**
 * Move valid objects.
 * Call Move method of the ball and players. Or show smash replay.
 *
 * @param KeyHistory history of keyboard input
 * @param MouseXHistory history of mouse cursor move
 * @param MouseYHistory history of mouse cursor move
 * @param MouseBHistory history of mouse button push/release
 * @param Histptr current position of histories described above.
 * @return returns true if it is neccesary to redraw.
 */
bool
SoloPlay::Move( SDL_keysym *KeyHistory, long *MouseXHistory,
		    long *MouseYHistory, unsigned long *MouseBHistory,
		    int Histptr ) {
  bool reDraw = false;
  long prevStatus = theBall.GetStatus();

  if ( KeyHistory[Histptr].unicode == 'Q' ) {
    wins = 0;
    mode = MODE_TITLE;
    return true;
  }

  if ( m_replayPtr >= 0 ) {	// Smash replay
    ReplayAction( m_replayPtr );

    if ( m_replayPtr == m_replayEndPtr ) {
      m_smashCount++;
      if ( m_smashCount > 1 ) {
	m_smashCount = 0;
	m_replayPtr = -1;
	m_smash = false;
      } else {
	m_replayPtr = m_replayStartPtr;
      }
    }

    return true;
  }

  theBall.Move();
  reDraw |= m_thePlayer->Move( KeyHistory, MouseXHistory,
			     MouseYHistory, MouseBHistory, Histptr );
  reDraw |= m_comPlayer->Move( NULL, NULL, NULL, NULL, 0 );

  // Check smash replay
  if ( theBall.GetStatus() == 1 && prevStatus != 1 ) {
    if ( hypot( theBall.GetV()[1], theBall.GetV()[2] ) > 8.0 ) {
      m_smash = true;
    } else
      m_smash = false;
  } else if ( theBall.GetStatus() == 2 || theBall.GetStatus() == 8 ) {
    m_smash = false;
  }

  if ( m_smash && theBall.GetStatus() < 0 ) {
    m_replayStartPtr = GetReplayStartPtr(Histptr);
    m_replayEndPtr = Histptr;
    m_replayPtr = m_replayStartPtr;
  }

  return true;
}

/**
 * Set camera position and direction.
 *
 * @param srcX camera position [out]
 * @param destX point where the camera is directed. [out]
 * @return returns true if succeeds.
 */
bool
SoloPlay::LookAt( vector3d &srcX, vector3d &destX ) {
  if (m_thePlayer) {
    if ( m_replayPtr >= 0 ) {	// Smash replay
      switch (m_smashCount) {
      case 0:
	srcX[0] = 0.0;
	srcX[1] = TABLELENGTH*m_thePlayer->GetSide();
	srcX[2] = 1.6;

	destX[0] = 0;
	destX[1] = -TABLELENGTH/2*m_thePlayer->GetSide();
	destX[2] = TABLEHEIGHT;
	break;
      case 1:
	srcX[0] = -TABLEWIDTH;
	srcX[1] = 0;
	srcX[2] = 1.6;

	destX = theBall.GetX();
	break;
      default:
	printf( "%d\n", (int)m_smashCount );
      }
    } else {
      srcX = m_thePlayer->GetX() + m_thePlayer->GetEye();
      if (fabs(m_thePlayer->GetX()[1]) < 2.0) {
        srcX[1] += m_thePlayer->GetX()[1]/2.0;
      } else {
        srcX[1] += -m_thePlayer->GetSide()*1.0;
      }

      destX = m_thePlayer->GetLookAt();
    }
  }

  return true;
}

/**
 * Do smash replay action.
 *
 * @param Histptr history pointer of rollbacked smash action.
 */
void
SoloPlay::ReplayAction( int &Histptr ) {
  static long delayCounter = 0;

  // If mouse button is pressed, stop replay
  // (Unless it is the last 1 second).
  if ( Event::TheEvent()->m_mouseButton && m_smashCount < 1 ) {
    struct Backtrack *backtrack = Event::TheEvent()->GetBackTrack(m_replayPtr);
    theBall = backtrack->theBall;
    m_thePlayer->Reset( &backtrack->thePlayer );
    m_comPlayer->Reset( &backtrack->comPlayer );

    ChangeScore( backtrack->score1, backtrack->score2);

    m_smashCount = 0;
    m_replayPtr = -1;
    m_smash = false;

    return;
  }

  delayCounter++;

  if ( theBall.GetStatus() == 3 &&
       (delayCounter%5) != 0 ) {
    return;
  } else {
    m_replayPtr++;
    if ( m_replayPtr > MAX_HISTORY-1 )
      m_replayPtr = 0;

    struct Backtrack *backtrack = Event::TheEvent()->GetBackTrack(m_replayPtr);
    theBall = backtrack->theBall;
    m_thePlayer->Reset( &backtrack->thePlayer );
    m_comPlayer->Reset( &backtrack->comPlayer );

    ChangeScore( backtrack->score1, backtrack->score2);

    theBall.Move();
    m_thePlayer->Move( NULL, NULL, NULL, NULL, 0 );
    m_comPlayer->Move( NULL, NULL, NULL, NULL, 0 );
  }
}

long
SoloPlay::GetReplayStartPtr(int histPtr) {
  for ( int i = 0 ; i < MAX_HISTORY ; i++ ) {
    if (Event::TheEvent()->GetBackTrack(histPtr)->theBall.GetStatus() == 2)
      break;

    histPtr--;
    if ( histPtr < 0 )
      histPtr = MAX_HISTORY-1;
  }

  return histPtr;
}
