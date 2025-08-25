/**
 * @file
 * @brief Definition of SoloPlay class.
 * @author KANNA Yoshihiro
 * @version $Id$
 */

// Copyright (C) 2000, 2004  神南 吉宏(Kanna Yoshihiro)
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

#ifndef _SoloPlay_
#define _SoloPlay_
#include "PlayGame.h"

/**
 * SoloPlay class is the controller class for solo play (play with com) mode.
 */
class SoloPlay : public PlayGame {
public:
  SoloPlay();
  virtual ~SoloPlay();

  virtual bool Init();

  static void Create( long player, long com );

  virtual bool Move( SDL_keysym *KeyHistory, long *MouseXHistory,
		     long *MouseYHistory, unsigned long *MouseBHistory,
		     int Histptr );

  virtual bool LookAt( vector3d &srcX, vector3d &destX );
protected:
  bool m_smash;		///< Whether smash is done or not.
  long m_smashCount;	///< counter of smash replay
  int  m_replayPtr;	///< HistPtr of replay

  int  m_replayStartPtr;///< HistPtr of replay start
  int  m_replayEndPtr;	///< HistPtr of replay end

  void ReplayAction( int &Histptr );
  long GetReplayStartPtr(int histPtr);
};

#endif	// _SoloPlay_
