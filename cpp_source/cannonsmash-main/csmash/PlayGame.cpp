/**
 * @file
 * @brief Implementation of PlayGame class.
 * @author KANNA Yoshihiro
 * @version $Id$
 */

// Copyright (C) 2000, 2002  神南 吉宏(Kanna Yoshihiro)
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
#include "PlayGame.h"
#include "Player.h"
#include "Ball.h"
#include "BaseView.h"
#include "Sound.h"
#include "RCFile.h"

extern RCFile *theRC;

extern Ball theBall;

extern long mode;
extern long wins;

/**
 * Default constructor.
 * Initialize member variables to 0 or NULL.
 */
PlayGame::PlayGame() {
  m_View = NULL;

  m_Score1 = 0;
  m_Score2 = 0;
  m_Game1 = 0;
  m_Game2 = 0;

  m_pause = false;
}

/**
 * Destructor.
 * Detatch m_View and delete it.
 */
PlayGame::~PlayGame() {
  if ( m_View ){
    BaseView::TheView()->RemoveView( m_View );
    delete m_View;
  }
}

/**
 * Returns which side of the player can serve.
 *
 * @return returns -1 if near side can serve. Otherwise returns 1.
 */
long
PlayGame::GetService() {
  long ret = 0;
  switch ( theRC->gameMode ) {
  case GAME_5PTS:
    ret = ((m_Score1+m_Score2) & 1 ? -1 : 1);
    break;
  case GAME_11PTS:
    if ( m_Score1 > 9 && m_Score2 > 9 ) {	// Deuce
      ret = ((m_Score1+m_Score2) & 1 ? -1 : 1);
    } else {
      if ( (m_Score1 + m_Score2)%4 >= 2 )
	ret = -1;
      else
	ret = 1;
    }
    break;
  case GAME_21PTS:
    if ( m_Score1 > 19 && m_Score2 > 19 ) {	// Deuce
      ret = ((m_Score1+m_Score2) & 1 ? -1 : 1);
    } else {
      if ( (m_Score1 + m_Score2)%10 >= 5 )
	ret = -1;
      else
	ret = 1;
    }
  }

  if ( (m_Game1+m_Game2)%2 )
    ret = -ret;

  return ret;
}

/**
 * Returns score of the specified player.
 *
 * @param p Player object of which score is requested.
 * @return returns score.
 */
long
PlayGame::GetScore( Player *p ) {
  if ( mode == MODE_SOLOPLAY || mode == MODE_MULTIPLAY ||
       mode == MODE_PRACTICE ) {
    if ( p->GetSide() > 0 )
      return m_Score1;
    else
      return m_Score2;
  } else {	// Training
    return m_Score1;
  }
}

/**
 * Returns score of the specified side.
 *
 * @param side side of which score is requested.
 * @return returns score.
 */
long
PlayGame::GetScore( long side ) {
  if ( mode == MODE_SOLOPLAY || mode == MODE_MULTIPLAY ||
       mode == MODE_PRACTICE) {
    if ( side > 0 )
      return m_Score1;
    else
      return m_Score2;
  } else {	// Training
    return m_Score1;
  }
}

/**
 * Returns game count of the specified player.
 *
 * @param p Player object of which score is requested.
 * @return returns game count.
 */
long
PlayGame::GetGame( Player *p ) {
  if ( mode == MODE_SOLOPLAY || mode == MODE_MULTIPLAY ||
       mode == MODE_PRACTICE ) {
    if ( p->GetSide() > 0 )
      return m_Game1;
    else
      return m_Game2;
  } else {	// Training
    return m_Game1;
  }
}

/**
 * Returns game count of the specified side.
 *
 * @param side side of which game count is requested.
 * @return returns score.
 */
long
PlayGame::GetGame( long side ) {
  if ( mode == MODE_SOLOPLAY || mode == MODE_MULTIPLAY ||
       mode == MODE_PRACTICE) {
    if ( side > 0 )
      return m_Game1;
    else
      return m_Game2;
  } else {	// Training
    return m_Game1;
  }
}

/**
 * Referring the ball status, add score to either side of players.
 * Add score to either side of players and call score.
 */
void
PlayGame::ChangeScore() {
  if ( mode == MODE_SOLOPLAY || mode == MODE_MULTIPLAY ||
       mode == MODE_PRACTICE) {
    if ( theBall.GetStatus() == 0 || theBall.GetStatus() == 3 ||
	 theBall.GetStatus() == 4 || theBall.GetStatus() == 6 ) {
      m_Score2++;
    } else {
      m_Score1++;
    }
  }

  Sound::TheSound()->PlayScore( m_Score1, m_Score2 );

  if ( theRC->gmode == GMODE_SIMPLE )
    printf( _("You : %d -  %d : Opponent\n"), GetScore(m_thePlayer),
	    GetScore(m_comPlayer) );
}

/**
 * Set score of both players.
 *
 * @param score1 score of near side
 * @param score2 score of far side
 */
void
PlayGame::ChangeScore( long score1, long score2 ) {
  m_Score1 = score1;
  m_Score2 = score2;
}

/**
 * Check whether the game is over or not.
 * Check whether the score of either player reaches the game point.
 *
 * @return returns true if the game is over.
 */
bool
PlayGame::IsGameEnd() {
  switch ( theRC->gameMode ) {
  case GAME_5PTS:
    if ( (m_Score1 > 4 || m_Score2 > 4) )
      return true;
    else
      return false;
  case GAME_11PTS:
    if ( (m_Score1 > 10 || m_Score2 > 10) && abs( m_Score1-m_Score2 ) > 1 )
      return true;
    else
      return false;
  case GAME_21PTS:
    if ( (m_Score1 > 20 || m_Score2 > 20) && abs( m_Score1-m_Score2 ) > 1 )
      return true;
    else
      return false;
  }

  return false;
}

/**
 * Re-initialize game score.
 */
void
PlayGame::EndGame() {
  // Re-initialize
  if ( GetScore(m_thePlayer) > GetScore(m_comPlayer) )
    wins++;
  else
    wins = 0;

  if ( wins > 0 )
    mode = MODE_SELECT;
  else
    mode = MODE_TITLE;

  m_Score1 = m_Score2 = 0;
}

/**
 * Setter method for m_pause.
 *
 * @param pause if it is true, game is paused.
 */
void
PlayGame::SetPause( bool pause ) {
  m_pause = pause;
}
